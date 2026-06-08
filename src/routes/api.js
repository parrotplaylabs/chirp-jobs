import { Router } from '../server/router.js';
import { config } from '../config.js';
import { applicationActivationPinEmail, jobActivationPinEmail } from '../lib/emailTemplates.js';
import { buildAbsoluteUrl, jobPath } from '../lib/helpers.js';
import { ensureCsrfToken, requireCsrf } from '../middleware/csrf.js';
import { destroySession, regenerateSession } from '../server/session.js';
import { createPendingApplication, verifyApplicationPin } from '../services/applicationService.js';
import { authenticate } from '../services/authService.js';
import { createActiveJob, createPendingJob, verifyJobPin } from '../services/jobService.js';
import { getArchivedEmail, listArchivedEmails, sendMail } from '../services/mailService.js';
import { store } from '../store/dataStore.js';

const router = new Router();
const PER_PAGE = 25;
const TABS = ['jobs', 'applications', 'categories', 'cities', 'audit', 'emails', 'database'];

function requireAdmin(req, res) {
  if (!req.session.adminId) res.status(401).json({ error: 'Unauthorized' });
}

function publicConfig(req) {
  return {
    appName: config.appName,
    appTheme: config.appTheme,
    isDemoEnv: config.appEnv === 'demo',
    isAdmin: Boolean(req.session.adminId),
    adminEmail: req.session.adminEmail || '',
    csrfToken: req.session.csrfToken || '',
    jobDefaultCompanyName: config.jobDefaultCompanyName,
    jobDefaultContactEmail: config.jobDefaultContactEmail,
  };
}

router.get('/api/config', async (req, res) => {
  res.json(publicConfig(req));
});

router.get('/api/meta/categories', async (_req, res) => {
  res.json({ categories: await store.listCategories() });
});

router.get('/api/meta/cities', async (_req, res) => {
  res.json({ cities: await store.listCities() });
});

router.get('/api/jobs', async (req, res) => {
  const categoryId = req.query.category ? Number(req.query.category) : null;
  const cityId = req.query.city ? Number(req.query.city) : null;
  const q = String(req.query.q || '');
  const jobs = await store.listActive({ categoryId, cityId, q });
  res.json({
    jobs,
    categories: await store.listCategories(),
    cities: await store.listCities(),
    filters: req.query,
  });
});

router.get('/api/jobs/random', async (req, res) => {
  const limit = Math.min(10, Math.max(1, Number(req.query.limit || 5)));
  const exclude = req.query.exclude ? Number(req.query.exclude) : null;
  res.json({ jobs: await store.listRandomActive(limit, exclude) });
});

router.post('/api/jobs', requireCsrf, async (req, res) => {
  if (res.ended) return;
  const defaultCompany = config.jobDefaultCompanyName;
  const defaultEmail = config.jobDefaultContactEmail;
  const companyName = String(req.body.company_name || '').trim() || defaultCompany;
  const contactEmail = String(req.body.contact_email || '').trim() || defaultEmail;
  const fields = {
    title: String(req.body.title || '').trim(),
    company_name: companyName,
    location: String(req.body.location || '').trim(),
    description: String(req.body.description || '').trim(),
    how_to_apply: String(req.body.how_to_apply || '').trim(),
    contact_email: contactEmail,
    category_id: Number(req.body.category_id),
    city_id: Number(req.body.city_id),
  };

  if (req.session.adminId) {
    const id = await createActiveJob(fields);
    await store.recordAudit({
      actor_type: 'admin',
      actor_id: String(req.session.adminId),
      action: 'job.created_by_admin',
      entity: 'job',
      entity_id: String(id),
      ip_address: req.ip,
      metadata_json: JSON.stringify({ title: fields.title, company: fields.company_name }),
    });
    const job = await store.findJobById(id);
    const path = job ? jobPath(job) : `/jobs/${id}`;
    return res.json({ redirect: `${path}?verified=1` });
  }

  const result = await createPendingJob(fields);
  const verifyUrl = buildAbsoluteUrl(config.appUrl, `/jobs/verify/${result.id}/${result.ownerToken}`);
  const html = jobActivationPinEmail({
    pin: result.pin,
    verifyUrl,
    year: new Date().getFullYear(),
  });
  await sendMail(fields.contact_email, 'Your Chirp Jobs activation PIN', html, true);
  await store.recordAudit({
    actor_type: 'public',
    actor_id: 'anonymous',
    action: 'job.created',
    entity: 'job',
    entity_id: String(result.id),
    ip_address: req.ip,
    metadata_json: JSON.stringify({ title: fields.title, company: fields.company_name }),
  });
  res.json({ redirect: `/jobs/verify/${result.id}/${result.ownerToken}` });
});

router.get('/api/jobs/verify/:id/:token', async (req, res) => {
  const id = Number(req.params.id);
  const token = req.params.token;
  const job = await store.findJobByIdAndToken(id, token);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    job,
    token,
    randomActiveJobs: await store.listRandomActive(5),
  });
});

router.post('/api/jobs/verify/:id/:token', requireCsrf, async (req, res) => {
  if (res.ended) return;
  const id = Number(req.params.id);
  const token = req.params.token;
  const pin = String(req.body.pin || '').trim();
  const rateKey = `job|${id}|${token}|${req.ip}`;
  const { pinMaxAttempts, pinWindowSeconds } = config.security;

  if (await store.isRateLimited('job.pin.verify', rateKey, pinMaxAttempts, pinWindowSeconds)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
  }

  if (pin && (await verifyJobPin(id, token, pin))) {
    await store.resetRateLimit('job.pin.verify', rateKey);
    await store.recordAudit({
      actor_type: 'public',
      actor_id: 'anonymous',
      action: 'job.activated_with_pin',
      entity: 'job',
      entity_id: String(id),
      ip_address: req.ip,
      metadata_json: '{}',
    });
    const job = await store.findJobById(id);
    const path = job ? jobPath(job) : `/jobs/${id}`;
    return res.json({ redirect: `${path}?verified=1` });
  }

  await store.recordRateFailure('job.pin.verify', rateKey, pinWindowSeconds);
  res.status(400).json({ error: 'Invalid or expired PIN. Please check your email and try again.' });
});

router.post('/api/jobs/:id/apply', requireCsrf, async (req, res) => {
  if (res.ended) return;
  const jobId = Number(req.params.id);
  const job = await store.findJobById(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const fields = {
    job_id: jobId,
    full_name: String(req.body.full_name || '').trim(),
    email: String(req.body.email || '').trim(),
    message: String(req.body.message || '').trim(),
  };

  const result = await createPendingApplication(fields);
  const verifyUrl = buildAbsoluteUrl(
    config.appUrl,
    `/jobs/${jobId}/apply/verify/${result.id}/${result.ownerToken}`
  );
  const html = applicationActivationPinEmail({
    job,
    pin: result.pin,
    verifyUrl,
    year: new Date().getFullYear(),
  });
  await sendMail(fields.email, 'Verify your application PIN', html, true);
  await store.recordAudit({
    actor_type: 'public',
    actor_id: 'anonymous',
    action: 'application.created_pending',
    entity: 'application',
    entity_id: String(result.id),
    ip_address: req.ip,
    metadata_json: JSON.stringify({ job_id: jobId, email: fields.email }),
  });
  res.json({ redirect: `/jobs/${jobId}/apply/verify/${result.id}/${result.ownerToken}` });
});

router.get('/api/jobs/:id/apply/verify/:applicationId/:token', async (req, res) => {
  const jobId = Number(req.params.id);
  const applicationId = Number(req.params.applicationId);
  const token = req.params.token;
  const application = await store.findApplicationByIdAndToken(applicationId, token);
  if (!application || application.job_id !== jobId) {
    return res.status(404).json({ error: 'Application not found' });
  }
  const job = await store.findJobById(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ job, application, token });
});

router.post('/api/jobs/:id/apply/verify/:applicationId/:token', requireCsrf, async (req, res) => {
  if (res.ended) return;
  const jobId = Number(req.params.id);
  const applicationId = Number(req.params.applicationId);
  const token = req.params.token;
  const pin = String(req.body.pin || '').trim();
  const rateKey = `application|${applicationId}|${token}|${req.ip}`;
  const { pinMaxAttempts, pinWindowSeconds } = config.security;

  const application = await store.findApplicationByIdAndToken(applicationId, token);
  if (!application || application.job_id !== jobId) {
    return res.status(404).json({ error: 'Application not found' });
  }
  const job = await store.findJobById(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (await store.isRateLimited('application.pin.verify', rateKey, pinMaxAttempts, pinWindowSeconds)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
  }

  if (pin && (await verifyApplicationPin(applicationId, token, pin))) {
    await store.resetRateLimit('application.pin.verify', rateKey);
    const verified = await store.findApplicationById(applicationId);
    if (verified) {
      await sendMail(
        job.contact_email,
        `New verified application for ${job.title}`,
        `Applicant: ${verified.full_name}\nEmail: ${verified.email}\n\n${verified.message}`
      );
    }
    await store.recordAudit({
      actor_type: 'public',
      actor_id: 'anonymous',
      action: 'application.verified_and_sent',
      entity: 'application',
      entity_id: String(applicationId),
      ip_address: req.ip,
      metadata_json: JSON.stringify({ job_id: jobId }),
    });
    return res.json({ redirect: `/jobs/${jobId}?applied=1` });
  }

  await store.recordRateFailure('application.pin.verify', rateKey, pinWindowSeconds);
  res.status(400).json({ error: 'Invalid or expired PIN. Please check your email and try again.' });
});

router.get('/api/jobs/:id', async (req, res) => {
  const id = Number(req.params.id);
  const job = await store.findJobById(id);
  if (!job || job.status !== 'active') return res.status(404).json({ error: 'Job not found' });

  if (!req.session.adminId) {
    await store.incrementClickCount(id);
    const refreshed = await store.findJobById(id);
    if (refreshed) Object.assign(job, refreshed);
  }

  job.application_count = await store.countVerifiedByJobId(id);
  const applySidebarJobs = req.session.adminId ? [] : await store.listRandomActive(3, id);

  res.json({
    job,
    applySidebarJobs,
    verified: req.query.verified === '1',
    applied: req.query.applied === '1',
  });
});

router.post('/api/admin/login', requireCsrf, async (req, res) => {
  if (res.ended) return;
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const rateKey = `${email.toLowerCase()}|${req.ip}`;
  const { loginMaxAttempts, loginWindowSeconds } = config.security;

  if (await store.isRateLimited('auth.login', rateKey, loginMaxAttempts, loginWindowSeconds)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
  }

  const admin = await authenticate(email, password);
  if (!admin) {
    await store.recordRateFailure('auth.login', rateKey, loginWindowSeconds);
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  await store.resetRateLimit('auth.login', rateKey);
  regenerateSession(req, res);
  req.session.adminId = admin.id;
  req.session.adminEmail = admin.email;
  ensureCsrfToken(req, res);
  await store.recordAudit({
    actor_type: 'admin',
    actor_id: String(admin.id),
    action: 'auth.login',
    entity: 'admin_user',
    entity_id: String(admin.id),
    ip_address: req.ip,
    metadata_json: '{}',
  });
  res.json({ ok: true, ...publicConfig(req) });
});

router.post('/api/admin/logout', requireCsrf, async (req, res) => {
  if (res.ended) return;
  const adminId = String(req.session.adminId || 'unknown');
  destroySession(req, res);
  await store.recordAudit({
    actor_type: 'admin',
    actor_id: adminId,
    action: 'auth.logout',
    entity: 'admin_user',
    entity_id: adminId,
    ip_address: req.ip,
    metadata_json: '{}',
  });
  res.json({ ok: true });
});

router.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  if (res.ended) return;
  let activeTab = String(req.query.tab || 'jobs');
  if (!TABS.includes(activeTab)) activeTab = 'jobs';

  let page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * PER_PAGE;

  let totalItems = 0;
  let jobs = [];
  let applications = [];
  let auditLogs = [];
  let emails = [];
  let categories = [];
  let cities = [];

  switch (activeTab) {
    case 'applications':
      totalItems = await store.countApplications();
      applications = await store.listApplicationsPaged(PER_PAGE, offset);
      break;
    case 'audit':
      totalItems = await store.countAudit();
      auditLogs = await store.listAuditPaged(PER_PAGE, offset);
      break;
    case 'emails': {
      const allEmails = await listArchivedEmails();
      totalItems = allEmails.length;
      emails = allEmails.slice(offset, offset + PER_PAGE);
      break;
    }
    case 'categories':
      totalItems = await store.countCategories();
      categories = await store.categoriesPagedWithJobCount(PER_PAGE, offset);
      break;
    case 'cities':
      totalItems = await store.countCities();
      cities = await store.citiesPagedWithJobCount(PER_PAGE, offset);
      break;
    case 'database':
      totalItems = 0;
      break;
    default:
      totalItems = await store.countForAdmin();
      jobs = await store.listForAdminPaged(PER_PAGE, offset);
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));
  if (page > totalPages) {
    page = totalPages;
    const newOffset = (page - 1) * PER_PAGE;
    switch (activeTab) {
      case 'applications':
        applications = await store.listApplicationsPaged(PER_PAGE, newOffset);
        break;
      case 'audit':
        auditLogs = await store.listAuditPaged(PER_PAGE, newOffset);
        break;
      case 'emails': {
        const allEmails = await listArchivedEmails();
        emails = allEmails.slice(newOffset, newOffset + PER_PAGE);
        break;
      }
      case 'categories':
        categories = await store.categoriesPagedWithJobCount(PER_PAGE, newOffset);
        break;
      case 'cities':
        cities = await store.citiesPagedWithJobCount(PER_PAGE, newOffset);
        break;
      default:
        jobs = await store.listForAdminPaged(PER_PAGE, newOffset);
    }
  }

  res.json({
    activeTab,
    jobs,
    applications,
    auditLogs,
    emails,
    categories,
    cities,
    pagination: { page, perPage: PER_PAGE, totalItems, totalPages },
  });
});

router.post('/api/admin/jobs/:id/:action', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const id = Number(req.params.id);
  const action = req.params.action;
  if (!['activate', 'deactivate'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  const status = action === 'activate' ? 'active' : 'inactive';
  await store.updateJobStatus(id, status);
  await store.recordAudit({
    actor_type: 'admin',
    actor_id: String(req.session.adminId),
    action: `job.${action}`,
    entity: 'job',
    entity_id: String(id),
    ip_address: req.ip,
    metadata_json: '{}',
  });
  res.json({ ok: true });
});

router.post('/api/admin/jobs/:id/delete', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const id = Number(req.params.id);
  if (id <= 0) return res.status(400).json({ error: 'Invalid job.' });
  const deleted = await store.deleteInactiveJob(id);
  if (!deleted) {
    return res.status(400).json({ error: 'Only inactive jobs can be deleted.' });
  }
  await store.recordAudit({
    actor_type: 'admin',
    actor_id: String(req.session.adminId),
    action: 'job.deleted',
    entity: 'job',
    entity_id: String(id),
    ip_address: req.ip,
    metadata_json: '{}',
  });
  res.json({ ok: true, notice: 'Job deleted.' });
});

router.post('/api/admin/categories', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const category = await store.createCategory(name);
    await store.recordAudit({
      actor_type: 'admin',
      actor_id: String(req.session.adminId),
      action: 'category.created',
      entity: 'category',
      entity_id: String(category.id),
      ip_address: req.ip,
      metadata_json: JSON.stringify({ name }),
    });
    res.json({ ok: true, notice: 'Category added.' });
  } catch {
    res.status(400).json({ error: 'Unable to add category (duplicate or invalid).' });
  }
});

router.post('/api/admin/categories/:id/update', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  if (id <= 0 || !name) return res.status(400).json({ error: 'Invalid category update.' });
  try {
    await store.updateCategory(id, name);
    await store.recordAudit({
      actor_type: 'admin',
      actor_id: String(req.session.adminId),
      action: 'category.updated',
      entity: 'category',
      entity_id: String(id),
      ip_address: req.ip,
      metadata_json: JSON.stringify({ name }),
    });
    res.json({ ok: true, notice: 'Category updated.' });
  } catch {
    res.status(400).json({ error: 'Unable to update category.' });
  }
});

router.post('/api/admin/categories/:id/delete', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const id = Number(req.params.id);
  try {
    await store.deleteCategory(id);
    await store.recordAudit({
      actor_type: 'admin',
      actor_id: String(req.session.adminId),
      action: 'category.deleted',
      entity: 'category',
      entity_id: String(id),
      ip_address: req.ip,
      metadata_json: '{}',
    });
    res.json({ ok: true, notice: 'Category deleted.' });
  } catch {
    res.status(400).json({ error: 'Unable to delete category. It may still be in use.' });
  }
});

router.post('/api/admin/cities', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'City name is required.' });
  try {
    const city = await store.createCity(name);
    await store.recordAudit({
      actor_type: 'admin',
      actor_id: String(req.session.adminId),
      action: 'city.created',
      entity: 'city',
      entity_id: String(city.id),
      ip_address: req.ip,
      metadata_json: JSON.stringify({ name }),
    });
    res.json({ ok: true, notice: 'City added.' });
  } catch {
    res.status(400).json({ error: 'Unable to add city (duplicate or invalid).' });
  }
});

router.post('/api/admin/cities/:id/update', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  if (id <= 0 || !name) return res.status(400).json({ error: 'Invalid city update.' });
  try {
    await store.updateCity(id, name);
    await store.recordAudit({
      actor_type: 'admin',
      actor_id: String(req.session.adminId),
      action: 'city.updated',
      entity: 'city',
      entity_id: String(id),
      ip_address: req.ip,
      metadata_json: JSON.stringify({ name }),
    });
    res.json({ ok: true, notice: 'City updated.' });
  } catch {
    res.status(400).json({ error: 'Unable to update city.' });
  }
});

router.post('/api/admin/cities/:id/delete', requireAdmin, requireCsrf, async (req, res) => {
  if (res.ended) return;
  const id = Number(req.params.id);
  try {
    await store.deleteCity(id);
    await store.recordAudit({
      actor_type: 'admin',
      actor_id: String(req.session.adminId),
      action: 'city.deleted',
      entity: 'city',
      entity_id: String(id),
      ip_address: req.ip,
      metadata_json: '{}',
    });
    res.json({ ok: true, notice: 'City deleted.' });
  } catch {
    res.status(400).json({ error: 'Unable to delete city. It may still be in use.' });
  }
});

router.get('/api/admin/applications/:id', requireAdmin, async (req, res) => {
  if (res.ended) return;
  const application = await store.findApplicationById(Number(req.params.id));
  if (!application) return res.status(404).json({ error: 'Application not found' });
  const job = await store.findJobById(application.job_id);
  res.json({ application, job });
});

router.get('/api/admin/emails/:file', requireAdmin, async (req, res) => {
  if (res.ended) return;
  const email = await getArchivedEmail(req.params.file);
  if (!email) return res.status(404).json({ error: 'Email not found' });
  res.json({ email });
});

router.get('/api/admin/database/download', requireAdmin, async (req, res) => {
  if (res.ended) return;
  const body = await store.exportJson();
  const filename = `chirpjobs_data_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 15)}.json`;
  await store.recordAudit({
    actor_type: 'admin',
    actor_id: String(req.session.adminId),
    action: 'database.downloaded',
    entity: 'database',
    entity_id: filename,
    ip_address: req.ip,
    metadata_json: JSON.stringify({ bytes: Buffer.byteLength(body) }),
  });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
});

export default router;
