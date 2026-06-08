const API = '/api';

let appConfig = null;

function icon(name, cls = '') {
  const classes = cls ? `icon ${cls}` : 'icon';
  return `<i data-lucide="${name}" class="${classes}" aria-hidden="true"></i>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(value) {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return slug || 'job';
}

function jobPath(job) {
  const id = job.id ?? 0;
  const base = `${job.title || ''}-${job.company_name || ''}`.replace(/^-+|-+$/g, '');
  return `/jobs/${id}/${slugify(base)}`;
}

function timeAgo(dateTime) {
  if (!dateTime) return 'Unknown date';
  const timestamp = Date.parse(dateTime);
  if (Number.isNaN(timestamp)) return 'Unknown date';
  const delta = Math.floor((Date.now() - timestamp) / 1000);
  if (delta < 60) return 'Just now';
  if (delta < 3600) {
    const minutes = Math.floor(delta / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (delta < 86400) {
    const hours = Math.floor(delta / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (delta < 604800) {
    const days = Math.floor(delta / 86400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  if (delta < 2592000) {
    const weeks = Math.floor(delta / 604800);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (delta < 31536000) {
    const months = Math.floor(delta / 2592000);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.floor(delta / 31536000);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function friendlyDate(dateTime) {
  if (!dateTime) return 'Unknown date';
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  clearTimeout(el._t);
  if (!msg) {
    el.textContent = '';
    el.classList.add('hidden');
    el.classList.remove('error');
    return;
  }
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.toggle('error', isError);
  el._t = setTimeout(() => toast(''), 4000);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  if (appConfig?.csrfToken) {
    headers['X-CSRF-Token'] = appConfig.csrfToken;
  }
  const res = await fetch(API + path, { credentials: 'include', ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

async function loadConfig() {
  appConfig = await api('/config');
  document.title = appConfig.appName;
  document.body.className = `theme-${appConfig.appTheme}`;
  renderHeader();
  const banner = document.getElementById('demo-banner');
  if (appConfig.isDemoEnv) {
    banner.innerHTML = `${icon('hourglass', 'icon--sm')} Demo environment — resets about every 12 hours.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function renderHeader() {
  const header = document.getElementById('site-header');
  if (!appConfig) return;
  const adminBlock = appConfig.isAdmin
    ? `<span class="badge-admin">${icon('shield-check', 'icon--sm')} Admin mode</span>
       <a class="btn btn-secondary btn-sm" href="/jobs/new">${icon('plus-circle', 'icon--sm')} Post a job</a>
       <a class="btn btn-outline btn-sm" href="/admin">${icon('shield', 'icon--sm')} Admin</a>
       <button class="btn btn-outline btn-sm" type="button" data-action="logout">${icon('log-out', 'icon--sm')} Logout</button>`
    : `<a class="btn btn-secondary btn-sm" href="/jobs/new">${icon('plus-circle', 'icon--sm')} Post a job</a>
       <a class="btn btn-outline btn-sm" href="/admin">${icon('shield', 'icon--sm')} Admin</a>`;
  header.innerHTML = `
    <a class="brand" href="/">${icon('briefcase')} ${escapeHtml(appConfig.appName)}</a>
    <div class="header-actions">${adminBlock}</div>`;
  refreshIcons();
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

function jobStatsTicker(job) {
  return `<div class="job-stats-ticker" role="status" aria-label="Views and applications">
    <div class="job-stats-ticker__inner">
      <span class="job-stats-ticker__stat" title="Views">${icon('flame', 'icon--sm')}<span>${job.click_count || 0}</span></span>
      <span class="job-stats-ticker__sep" aria-hidden="true"></span>
      <span class="job-stats-ticker__stat" title="Applications">${icon('user', 'icon--sm')}<span>${job.application_count || 0}</span></span>
    </div>
  </div>`;
}

function sidebarJobs(jobs, title, showDate = true) {
  const items = (jobs || []).length
    ? jobs.map((item) => `<li>
        <a href="${jobPath(item)}">${escapeHtml(item.title)}</a>
        <div class="small muted">${icon('building-2', 'icon--sm')} ${escapeHtml(item.company_name)} · ${escapeHtml(item.location)}</div>
        ${showDate ? `<div class="small muted" title="${escapeHtml(friendlyDate(item.created_at))}">${icon('clock', 'icon--sm')} Posted ${timeAgo(item.created_at)}</div>` : ''}
      </li>`).join('')
    : '<li class="hint small">No active jobs yet.</li>';
  return `<div class="panel panel--sidebar">
    <div class="panel-title">${icon('list', 'icon--sm')} ${escapeHtml(title)}</div>
    <ul class="sidebar-list">${items}</ul>
  </div>`;
}

function parseRoute() {
  const url = new URL(location.href);
  const parts = url.pathname.split('/').filter(Boolean);
  const q = Object.fromEntries(url.searchParams.entries());
  if (parts.length === 0) return { name: 'home', query: q };
  if (parts[0] === 'jobs' && parts[1] === 'new') return { name: 'job-new', query: q };
  if (parts[0] === 'jobs' && parts[1] === 'verify' && parts[2] && parts[3]) {
    return { name: 'job-verify', id: parts[2], token: parts[3], query: q };
  }
  if (parts[0] === 'jobs' && parts[1] && parts[2] === 'apply' && parts[3] === 'verify' && parts[4] && parts[5]) {
    return { name: 'application-verify', jobId: parts[1], applicationId: parts[4], token: parts[5], query: q };
  }
  if (parts[0] === 'jobs' && parts[1] && Number(parts[1])) {
    return { name: 'job-show', id: parts[1], query: q };
  }
  if (parts[0] === 'admin' && parts[1] === 'login') return { name: 'admin-login', query: q };
  if (parts[0] === 'admin' && parts[1] === 'applications' && parts[2]) {
    return { name: 'admin-application', id: parts[2], query: q };
  }
  if (parts[0] === 'admin' && parts[1] === 'emails' && parts[2]) {
    return { name: 'admin-email', file: parts[2], query: q };
  }
  if (parts[0] === 'admin') return { name: 'admin', query: q };
  return { name: 'not-found', query: q };
}

function navigate(path) {
  history.pushState(null, '', path);
  route();
}

async function route() {
  const r = parseRoute();
  const app = document.getElementById('app');
  app.innerHTML = '<p class="hint">Loading…</p>';
  try {
    switch (r.name) {
      case 'home': await renderHome(app, r.query); break;
      case 'job-new': await renderJobNew(app); break;
      case 'job-show': await renderJobShow(app, r.id, r.query); break;
      case 'job-verify': await renderJobVerify(app, r.id, r.token); break;
      case 'application-verify': await renderApplicationVerify(app, r.jobId, r.applicationId, r.token); break;
      case 'admin-login': await renderAdminLogin(app); break;
      case 'admin': await renderAdmin(app, r.query); break;
      case 'admin-application': await renderAdminApplication(app, r.id, r.query); break;
      case 'admin-email': await renderAdminEmail(app, r.file); break;
      default: renderNotFound(app); break;
    }
  } catch (err) {
    app.innerHTML = `<div class="notice notice-danger">${icon('alert-circle', 'icon--sm')} ${escapeHtml(err.message)}</div>`;
    refreshIcons();
  }
}

function renderNotFound(app) {
  app.innerHTML = `<div class="panel"><h1>Page not found</h1><p class="hint"><a href="/">Back to home</a></p></div>`;
}

async function renderHome(app, query) {
  const params = new URLSearchParams(query);
  const data = await api(`/jobs?${params}`);
  const categoryOpts = data.categories.map((c) =>
    `<option value="${c.id}" ${String(query.category) === String(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');
  const cityOpts = data.cities.map((c) =>
    `<option value="${c.id}" ${String(query.city) === String(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');
  const jobsHtml = data.jobs.length
    ? `<div class="job-grid">${data.jobs.map((job) => `<article class="job-card">
        <div class="job-card__body">
          <h2 class="job-card__title"><a href="${jobPath(job)}">${escapeHtml(job.title)}</a></h2>
          <p class="job-card__meta">${icon('building-2', 'icon--sm')} ${escapeHtml(job.company_name)} · ${icon('map-pin', 'icon--sm')} ${escapeHtml(job.location)}</p>
          <p class="job-card__meta small" title="${escapeHtml(friendlyDate(job.created_at))}">${icon('clock', 'icon--sm')} Posted ${timeAgo(job.created_at)}</p>
          <p class="job-card__excerpt">${escapeHtml(job.description.slice(0, 140))}…</p>
          <a class="btn btn-primary btn-sm" href="${jobPath(job)}">${icon('arrow-right', 'icon--sm')} View job</a>
        </div>
        ${jobStatsTicker(job)}
      </article>`).join('')}</div>`
    : `<p class="hint">${icon('inbox', 'icon--sm')} No jobs found.</p>`;

  app.innerHTML = `
    <div class="panel hero-panel"><h1>${icon('briefcase', 'heading-icon')} Find your next opportunity</h1><p class="hint">Browse lightweight listings and apply directly.</p></div>
    <form class="panel" id="home-filter">
      <div class="filter-bar">
        <label><span class="sr-only">Search jobs</span><input type="text" name="q" placeholder="Search jobs…" value="${escapeHtml(query.q || '')}" autocomplete="off" /></label>
        <label><span class="sr-only">Category</span><select name="category"><option value="">All categories</option>${categoryOpts}</select></label>
        <label><span class="sr-only">Location</span><select name="city"><option value="">All locations</option>${cityOpts}</select></label>
        <button class="btn btn-primary" type="submit">${icon('search', 'icon--sm')} Search</button>
      </div>
    </form>
    ${jobsHtml}`;
  refreshIcons();
}

async function renderJobNew(app) {
  const [meta, random] = await Promise.all([
    api('/meta/categories').then(async (c) => ({ categories: c.categories, cities: (await api('/meta/cities')).cities })),
    api('/jobs/random?limit=5'),
  ]);
  const categoryOpts = meta.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const cityOpts = meta.cities.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const adminNote = appConfig.isAdmin
    ? `<div class="notice notice-success">${icon('shield-check', 'icon--sm')} Admin mode: this job will be published immediately (PIN verification is skipped).</div>`
    : '';
  const submitLabel = appConfig.isAdmin
    ? `${icon('upload', 'icon--sm')} Publish job now`
    : `${icon('arrow-right', 'icon--sm')} Continue to verification`;
  const infoNote = appConfig.isAdmin
    ? `${icon('info', 'icon--sm')} You are logged in as admin, so this job will be published immediately.`
    : `${icon('mail', 'icon--sm')} After posting, we will email a PIN to activate your job listing.`;

  app.innerHTML = `<div class="split split--main-wide">
    <section>
      <h1>${icon('plus-circle', 'heading-icon')} Post a new job</h1>
      ${adminNote}
      <form class="panel" id="job-form">
        <div class="form-grid">
          <label>Job title <input name="title" required /></label>
          <label>Company name <input name="company_name" value="${escapeHtml(appConfig.jobDefaultCompanyName)}" required /></label>
          <label>Location <input name="location" placeholder="e.g. Remote" required /></label>
          <label>Contact email <input name="contact_email" type="email" value="${escapeHtml(appConfig.jobDefaultContactEmail)}" required /></label>
          <label>Category <select name="category_id" required><option value="">Select category</option>${categoryOpts}</select></label>
          <label>City <select name="city_id" required><option value="">Select city</option>${cityOpts}</select></label>
          <label class="full">Job description <textarea name="description" rows="5" required></textarea></label>
          <label class="full">How to apply <textarea name="how_to_apply" rows="3" required></textarea></label>
          <div class="full"><div class="notice notice-info" style="margin-bottom:0;">${infoNote}</div></div>
          <div class="full form-actions"><button class="btn btn-primary" type="submit">${submitLabel}</button></div>
        </div>
      </form>
    </section>
    <aside>${sidebarJobs(random.jobs, 'Other jobs')}</aside>
  </div>`;
  refreshIcons();
}

async function renderJobShow(app, id, query) {
  const params = new URLSearchParams(query);
  const data = await api(`/jobs/${id}?${params}`);
  const { job, applySidebarJobs, applied } = data;
  const notice = applied
    ? `<div class="notice notice-success">${icon('check-circle', 'icon--sm')} Your application has been verified and sent to the job poster.</div>`
    : '';
  const applyBlock = appConfig.isAdmin
    ? `<div class="notice notice-info">${icon('shield-check', 'icon--sm')} You are logged in as admin. Applicant form is hidden in admin mode.</div>`
    : `<div class="split split--main-wide">
        <section class="panel">
          <h2>${icon('send', 'icon--sm')} Apply to this job</h2>
          <form id="apply-form">
            <div class="form-grid">
              <label>Full name <input name="full_name" required autocomplete="name" /></label>
              <label>Email <input name="email" type="email" required autocomplete="email" /></label>
              <label class="full">Cover letter or message <textarea name="message" rows="5" required></textarea></label>
              <div class="full form-actions"><button class="btn btn-primary" type="submit">${icon('send', 'icon--sm')} Send application</button></div>
            </div>
          </form>
        </section>
        ${applySidebarJobs.length ? `<aside>${sidebarJobs(applySidebarJobs, 'More openings')}</aside>` : ''}
      </div>`;

  app.innerHTML = `
    ${notice}
    <article class="panel" style="padding:0;overflow:hidden;">
      <div style="padding:1.25rem;">
        <h1>${escapeHtml(job.title)}</h1>
        <p class="muted">${icon('building-2', 'icon--sm')} ${escapeHtml(job.company_name)} · ${icon('map-pin', 'icon--sm')} ${escapeHtml(job.location)}</p>
        <p class="small muted" title="${escapeHtml(friendlyDate(job.created_at))}">${icon('clock', 'icon--sm')} Posted ${timeAgo(job.created_at)}</p>
        <p>${escapeHtml(job.description)}</p>
        <h2>${icon('file-text', 'icon--sm')} How to apply</h2>
        <p>${escapeHtml(job.how_to_apply)}</p>
      </div>
      ${jobStatsTicker(job)}
    </article>
    ${applyBlock}`;
  app.dataset.jobId = id;
  refreshIcons();
}

async function renderJobVerify(app, id, token) {
  const data = await api(`/jobs/verify/${id}/${token}`);
  app.innerHTML = `<div class="split split--main-wide">
    <section>
      <h1>${icon('shield-check', 'heading-icon')} Verify and activate job</h1>
      <div class="panel">
        <p><strong>${escapeHtml(data.job.title)}</strong></p>
        <p class="muted" style="margin:0;">${icon('building-2', 'icon--sm')} ${escapeHtml(data.job.company_name)} · ${icon('map-pin', 'icon--sm')} ${escapeHtml(data.job.location)}</p>
      </div>
      <form class="panel" id="job-verify-form">
        <div id="job-verify-error"></div>
        <label>${icon('key-round', 'icon--sm')} Enter PIN from email
          <input type="text" name="pin" maxlength="6" placeholder="6-digit PIN" required />
        </label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check-circle', 'icon--sm')} Activate job</button></div>
      </form>
    </section>
    <aside>${sidebarJobs(data.randomActiveJobs, 'Other jobs', false)}</aside>
  </div>`;
  app.dataset.verifyId = id;
  app.dataset.verifyToken = token;
  refreshIcons();
}

async function renderApplicationVerify(app, jobId, applicationId, token) {
  const data = await api(`/jobs/${jobId}/apply/verify/${applicationId}/${token}`);
  app.innerHTML = `<div class="centered-narrow">
    <h1>${icon('badge-check', 'heading-icon')} Verify your application</h1>
    <div class="panel">
      <p><strong>${escapeHtml(data.job.title)}</strong></p>
      <p class="muted" style="margin:0;">${icon('building-2', 'icon--sm')} ${escapeHtml(data.job.company_name)} · ${icon('map-pin', 'icon--sm')} ${escapeHtml(data.job.location)}</p>
    </div>
    <form class="panel" id="application-verify-form">
      <div id="application-verify-error"></div>
      <p class="small muted">${icon('mail', 'icon--sm')} We sent a 6-digit PIN to <strong>${escapeHtml(data.application.email)}</strong>. Enter it below to confirm your application.</p>
      <label>${icon('key-round', 'icon--sm')} Enter PIN from email
        <input type="text" name="pin" maxlength="6" placeholder="6-digit PIN" required />
      </label>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check-circle', 'icon--sm')} Verify and send application</button></div>
    </form>
  </div>`;
  app.dataset.jobId = jobId;
  app.dataset.applicationId = applicationId;
  app.dataset.applicationToken = token;
  refreshIcons();
}

async function renderAdminLogin(app) {
  if (appConfig.isAdmin) {
    navigate('/admin');
    return;
  }
  app.innerHTML = `<div class="login-wrap">
    <div class="login-brand"><p>${icon('briefcase', 'icon--lg')}</p><h1>${escapeHtml(appConfig.appName)}</h1><p class="hint">Sign in to admin dashboard</p></div>
    <div class="panel">
      <div id="login-error"></div>
      <form id="login-form">
        <div class="form-grid" style="grid-template-columns:1fr;">
          <label><span class="field-label">${icon('mail', 'icon--sm')} Email</span><input name="email" type="email" placeholder="admin@example.com" required /></label>
          <label><span class="field-label">${icon('lock', 'icon--sm')} Password</span><input name="password" type="password" required /></label>
          <div class="form-actions"><button class="btn btn-primary btn-lg btn-block" type="submit">${icon('log-in', 'icon--sm')} Log in</button></div>
        </div>
      </form>
    </div>
  </div>`;
  refreshIcons();
}

const ADMIN_TABS = [
  { id: 'jobs', label: 'Jobs', iconName: 'briefcase' },
  { id: 'applications', label: 'Applications', iconName: 'users' },
  { id: 'categories', label: 'Categories', iconName: 'tags' },
  { id: 'cities', label: 'Cities', iconName: 'map-pin' },
  { id: 'audit', label: 'Audit trail', iconName: 'scroll-text' },
  { id: 'emails', label: 'Emails', iconName: 'mail' },
  { id: 'database', label: 'Data', iconName: 'database' },
];

async function renderAdmin(app, query) {
  if (!appConfig.isAdmin) {
    navigate('/admin/login');
    return;
  }
  const tab = query.tab || 'jobs';
  const page = query.page || '1';
  const notice = query.notice || '';
  const data = await api(`/admin/dashboard?tab=${encodeURIComponent(tab)}&page=${encodeURIComponent(page)}`);
  const tabsHtml = ADMIN_TABS.map((t) =>
    `<a class="${data.activeTab === t.id ? 'active' : ''}" href="/admin?tab=${t.id}&page=1">${icon(t.iconName, 'icon--sm')} ${t.label}</a>`
  ).join('');
  const noticeHtml = notice ? `<div class="notice notice-info">${icon('info', 'icon--sm')} ${escapeHtml(notice)}</div>` : '';

  let content = '';
  if (data.activeTab === 'jobs') {
    content = renderAdminJobsTable(data.jobs, data.pagination);
  } else if (data.activeTab === 'applications') {
    content = renderAdminApplicationsTable(data.applications, data.pagination);
  } else if (data.activeTab === 'categories') {
    content = renderAdminCategories(data.categories, data.pagination);
  } else if (data.activeTab === 'cities') {
    content = renderAdminCities(data.cities, data.pagination);
  } else if (data.activeTab === 'audit') {
    content = renderAdminAudit(data.auditLogs);
  } else if (data.activeTab === 'emails') {
    content = renderAdminEmails(data.emails);
  } else if (data.activeTab === 'database') {
    content = `<div class="panel"><h2>${icon('database', 'icon--sm')} JSON data backup</h2>
      <p class="hint small">Download a copy of the application data file. Back up this file before upgrades or migrations.</p>
      <a class="btn btn-primary" href="/api/admin/database/download">${icon('download', 'icon--sm')} Download data</a></div>`;
  }

  const pagination = data.pagination.totalItems > data.pagination.perPage
    ? `<nav class="pagination">${data.pagination.page <= 1
      ? `<span class="disabled">${icon('chevron-left', 'icon--sm')} Prev</span>`
      : `<a href="/admin?tab=${data.activeTab}&page=${data.pagination.page - 1}">${icon('chevron-left', 'icon--sm')} Prev</a>`}
      ${data.pagination.page >= data.pagination.totalPages
      ? `<span class="disabled">Next ${icon('chevron-right', 'icon--sm')}</span>`
      : `<a href="/admin?tab=${data.activeTab}&page=${data.pagination.page + 1}">Next ${icon('chevron-right', 'icon--sm')}</a>`}
    </nav>` : '';

  app.innerHTML = `<div class="toolbar"><h1>${icon('layout-dashboard', 'heading-icon')} Admin dashboard</h1></div>
    ${noticeHtml}
    <nav class="admin-tabs">${tabsHtml}</nav>
    ${content}
    ${pagination}`;
  app.dataset.adminTab = data.activeTab;
  app.dataset.adminPage = String(data.pagination.page);
  refreshIcons();
}

function renderAdminJobsTable(jobs, pagination) {
  const rows = jobs.length ? jobs.map((job) => `<tr>
    <td class="muted small mono">${job.id}</td>
    <td>${escapeHtml(job.title)}</td>
    <td class="text-center mono muted">${job.click_count || 0}</td>
    <td class="text-center mono muted">${job.application_count || 0}</td>
    <td>${escapeHtml(job.status)}</td>
    <td><div class="table-actions">
      ${job.status === 'active' ? `<a class="btn btn-outline btn-sm" href="${jobPath(job)}">${icon('eye', 'icon--sm')} View</a>` : '<span class="btn btn-outline btn-sm disabled">View</span>'}
      ${job.status !== 'active' ? `<button class="btn btn-success btn-sm" data-action="job-activate" data-id="${job.id}">${icon('check-circle', 'icon--sm')} Activate</button>` : ''}
      ${job.status === 'active' ? `<button class="btn btn-warning btn-sm" data-action="job-deactivate" data-id="${job.id}">${icon('pause-circle', 'icon--sm')} Deactivate</button>` : ''}
      ${job.status === 'inactive' ? `<button class="btn btn-danger btn-sm" data-action="job-delete" data-id="${job.id}">${icon('trash-2', 'icon--sm')} Delete</button>` : ''}
    </div></td>
  </tr>`).join('') : '<tr><td colspan="6">No jobs.</td></tr>';
  return `<div class="panel panel--flush-table"><div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Title</th><th>Views</th><th>Apps</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderAdminApplicationsTable(applications, pagination) {
  const rows = applications.length ? applications.map((a) => `<tr>
    <td>${escapeHtml(a.job_title || '(Unknown job)')}</td>
    <td>${escapeHtml(a.full_name)}</td>
    <td class="muted">${escapeHtml(a.email)}</td>
    <td>${friendlyDate(a.created_at)}<div class="small muted">${timeAgo(a.created_at)}</div></td>
    <td class="text-end"><a class="btn btn-outline btn-sm" href="/admin/applications/${a.id}?page=${pagination.page}">${icon('eye', 'icon--sm')} View</a></td>
  </tr>`).join('') : '<tr><td colspan="5">No applications.</td></tr>';
  return `<div class="panel panel--flush-table"><div class="table-wrap"><table>
    <thead><tr><th>Job</th><th>Name</th><th>Email</th><th>Created</th><th class="text-end">Action</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderAdminCategories(categories, pagination) {
  const rows = categories.map((c) => `<tr>
    <td class="muted small mono">${c.id}</td>
    <td><form class="inline-form" data-action="category-update" data-id="${c.id}">
      <input type="text" name="name" value="${escapeHtml(c.name)}" required />
      <button class="btn btn-outline btn-sm" type="submit">${icon('save', 'icon--sm')} Save</button>
    </form></td>
    <td><span class="badge">${c.jobs_count}</span></td>
    <td class="text-end"><button class="btn btn-danger btn-sm" data-action="category-delete" data-id="${c.id}">${icon('trash-2', 'icon--sm')} Delete</button></td>
  </tr>`).join('');
  return `<div class="panel"><form class="filter-bar" style="grid-template-columns:1fr auto;" data-action="category-add">
    <input type="text" name="name" placeholder="Add new category" required />
    <button class="btn btn-primary" type="submit">${icon('plus', 'icon--sm')} Add category</button>
  </form></div>
  <div class="panel panel--flush-table"><div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Name</th><th>Jobs</th><th class="text-end">Action</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderAdminCities(cities, pagination) {
  const rows = cities.map((c) => `<tr>
    <td class="muted small mono">${c.id}</td>
    <td><form class="inline-form" data-action="city-update" data-id="${c.id}">
      <input type="text" name="name" value="${escapeHtml(c.name)}" required />
      <button class="btn btn-outline btn-sm" type="submit">${icon('save', 'icon--sm')} Save</button>
    </form></td>
    <td><span class="badge">${c.jobs_count}</span></td>
    <td class="text-end"><button class="btn btn-danger btn-sm" data-action="city-delete" data-id="${c.id}">${icon('trash-2', 'icon--sm')} Delete</button></td>
  </tr>`).join('');
  return `<div class="panel"><form class="filter-bar" style="grid-template-columns:1fr auto;" data-action="city-add">
    <input type="text" name="name" placeholder="Add new city" required />
    <button class="btn btn-primary" type="submit">${icon('plus', 'icon--sm')} Add city</button>
  </form></div>
  <div class="panel panel--flush-table"><div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Name</th><th>Jobs</th><th class="text-end">Action</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderAdminAudit(logs) {
  const rows = logs.map((log) => `<tr>
    <td>${friendlyDate(log.created_at)}<div class="small muted">${timeAgo(log.created_at)}</div></td>
    <td>${escapeHtml(log.actor_type)}:${escapeHtml(log.actor_id)}</td>
    <td>${escapeHtml(log.action)}</td>
    <td>${escapeHtml(log.entity)}#${escapeHtml(log.entity_id)}</td>
    <td><code>${escapeHtml((log.metadata_json || '').slice(0, 80))}</code></td>
  </tr>`).join('');
  return `<div class="panel panel--flush-table"><div class="table-wrap"><table>
    <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Meta</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderAdminEmails(emails) {
  const rows = emails.length ? emails.map((email) => `<tr>
    <td>${friendlyDate(email.date)}<div class="small muted">${timeAgo(email.date)}</div></td>
    <td>${escapeHtml(email.subject)}</td>
    <td class="muted">${escapeHtml(email.recipient)}</td>
    <td class="text-end"><a class="btn btn-outline btn-sm" href="/admin/emails/${encodeURIComponent(email.file)}">${icon('eye', 'icon--sm')} View</a></td>
  </tr>`).join('') : '<tr><td colspan="4">No archived emails. Emails are archived when SMTP is disabled.</td></tr>';
  return `<div class="panel panel--flush-table"><div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Subject</th><th>To</th><th class="text-end">Action</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

async function renderAdminApplication(app, id, query) {
  if (!appConfig.isAdmin) { navigate('/admin/login'); return; }
  const data = await api(`/admin/applications/${id}`);
  const backPage = query.page || '1';
  app.innerHTML = `
    <p><a href="/admin?tab=applications&page=${backPage}" class="btn btn-secondary btn-sm">${icon('arrow-left', 'icon--sm')} Back to applications</a></p>
    <div class="panel">
      <h1>${icon('user', 'heading-icon')} Application from ${escapeHtml(data.application.full_name)}</h1>
      ${data.job ? `<p class="hint">${icon('briefcase', 'icon--sm')} For: <strong>${escapeHtml(data.job.title)}</strong> at ${escapeHtml(data.job.company_name)}</p>` : ''}
      <dl class="detail-list">
        <dt>${icon('mail', 'icon--sm')} Email</dt><dd>${escapeHtml(data.application.email)}</dd>
        <dt>${icon('info', 'icon--sm')} Status</dt><dd>${escapeHtml(data.application.status)}</dd>
        <dt>${icon('calendar', 'icon--sm')} Submitted</dt><dd>${friendlyDate(data.application.created_at)} (${timeAgo(data.application.created_at)})</dd>
        <dt>${icon('message-square', 'icon--sm')} Message</dt><dd><pre class="message-pre">${escapeHtml(data.application.message)}</pre></dd>
      </dl>
    </div>`;
  refreshIcons();
}

async function renderAdminEmail(app, file) {
  if (!appConfig.isAdmin) { navigate('/admin/login'); return; }
  const data = await api(`/admin/emails/${encodeURIComponent(file)}`);
  const body = data.email.isHtml
    ? `<div>${data.email.body}</div>`
    : `<pre class="message-pre">${escapeHtml(data.email.body)}</pre>`;
  app.innerHTML = `
    <p><a href="/admin?tab=emails" class="btn btn-secondary btn-sm">${icon('arrow-left', 'icon--sm')} Back to emails</a></p>
    <div class="panel">
      <h1>${icon('mail', 'heading-icon')} ${escapeHtml(data.email.subject)}</h1>
      <p class="small muted">${icon('user', 'icon--sm')} To: ${escapeHtml(data.email.recipient)}</p>
      <hr class="divider" />${body}
    </div>`;
  refreshIcons();
}

function formToObject(form) {
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = value; });
  return data;
}

document.addEventListener('click', async (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const app = document.getElementById('app');

  if (action === 'logout') {
    e.preventDefault();
    await api('/admin/logout', { method: 'POST', body: {} });
    await loadConfig();
    navigate('/admin/login');
    return;
  }

  const tab = app.dataset.adminTab || 'jobs';
  const page = app.dataset.adminPage || '1';

  try {
    if (action === 'job-activate' || action === 'job-deactivate') {
      const id = actionEl.dataset.id;
      await api(`/admin/jobs/${id}/${action === 'job-activate' ? 'activate' : 'deactivate'}`, { method: 'POST', body: {} });
      navigate(`/admin?tab=${tab}&page=${page}`);
    } else if (action === 'job-delete') {
      if (!confirm('Delete this job permanently?')) return;
      const result = await api(`/admin/jobs/${actionEl.dataset.id}/delete`, { method: 'POST', body: {} });
      navigate(`/admin?tab=jobs&page=${page}&notice=${encodeURIComponent(result.notice || 'Job deleted.')}`);
    } else if (action === 'category-delete' || action === 'city-delete') {
      if (!confirm(`Delete this ${action.includes('category') ? 'category' : 'city'}?`)) return;
      const kind = action.includes('category') ? 'categories' : 'cities';
      const result = await api(`/admin/${kind}/${actionEl.dataset.id}/delete`, { method: 'POST', body: {} });
      navigate(`/admin?tab=${kind}&page=${page}&notice=${encodeURIComponent(result.notice || 'Deleted.')}`);
    }
  } catch (err) {
    toast(err.message, true);
  }
});

document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === 'home-filter') {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(form));
    navigate(`/?${params}`);
    return;
  }

  if (form.id === 'login-form') {
    e.preventDefault();
    try {
      await api('/admin/login', { method: 'POST', body: formToObject(form) });
      await loadConfig();
      navigate('/admin');
    } catch (err) {
      document.getElementById('login-error').innerHTML = `<div class="notice notice-danger">${icon('alert-circle', 'icon--sm')} ${escapeHtml(err.message)}</div>`;
      refreshIcons();
    }
    return;
  }

  if (form.id === 'job-form') {
    e.preventDefault();
    try {
      const result = await api('/jobs', { method: 'POST', body: formToObject(form) });
      if (result.redirect) navigate(result.redirect);
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }

  if (form.id === 'apply-form') {
    e.preventDefault();
    const appEl = document.getElementById('app');
    try {
      const result = await api(`/jobs/${appEl.dataset.jobId}/apply`, { method: 'POST', body: formToObject(form) });
      if (result.redirect) navigate(result.redirect);
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }

  if (form.id === 'job-verify-form') {
    e.preventDefault();
    const appEl = document.getElementById('app');
    try {
      const result = await api(`/jobs/verify/${appEl.dataset.verifyId}/${appEl.dataset.verifyToken}`, {
        method: 'POST',
        body: formToObject(form),
      });
      if (result.redirect) navigate(result.redirect);
    } catch (err) {
      document.getElementById('job-verify-error').innerHTML = `<div class="notice notice-danger">${icon('alert-circle', 'icon--sm')} ${escapeHtml(err.message)}</div>`;
      refreshIcons();
    }
    return;
  }

  if (form.id === 'application-verify-form') {
    e.preventDefault();
    const appEl = document.getElementById('app');
    try {
      const result = await api(`/jobs/${appEl.dataset.jobId}/apply/verify/${appEl.dataset.applicationId}/${appEl.dataset.applicationToken}`, {
        method: 'POST',
        body: formToObject(form),
      });
      if (result.redirect) navigate(result.redirect);
    } catch (err) {
      document.getElementById('application-verify-error').innerHTML = `<div class="notice notice-danger">${icon('alert-circle', 'icon--sm')} ${escapeHtml(err.message)}</div>`;
      refreshIcons();
    }
    return;
  }

  const action = form.dataset.action;
  const appEl = document.getElementById('app');
  const page = appEl.dataset.adminPage || '1';
  if (!action) return;
  e.preventDefault();

  try {
    let result;
    if (action === 'category-add') {
      result = await api('/admin/categories', { method: 'POST', body: formToObject(form) });
      navigate(`/admin?tab=categories&page=1&notice=${encodeURIComponent(result.notice)}`);
    } else if (action === 'category-update') {
      result = await api(`/admin/categories/${form.dataset.id}/update`, { method: 'POST', body: formToObject(form) });
      navigate(`/admin?tab=categories&page=${page}&notice=${encodeURIComponent(result.notice)}`);
    } else if (action === 'city-add') {
      result = await api('/admin/cities', { method: 'POST', body: formToObject(form) });
      navigate(`/admin?tab=cities&page=1&notice=${encodeURIComponent(result.notice)}`);
    } else if (action === 'city-update') {
      result = await api(`/admin/cities/${form.dataset.id}/update`, { method: 'POST', body: formToObject(form) });
      navigate(`/admin?tab=cities&page=${page}&notice=${encodeURIComponent(result.notice)}`);
    }
  } catch (err) {
    toast(err.message, true);
  }
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="/"]');
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('/api/')) return;
  e.preventDefault();
  navigate(href);
});

window.addEventListener('popstate', () => route());

async function init() {
  await loadConfig();
  await route();
}

init();
