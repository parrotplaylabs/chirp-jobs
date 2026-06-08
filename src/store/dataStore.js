import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { nowIso } from '../lib/helpers.js';

const EMPTY_DATA = {
  meta: {
    nextId: {
      adminUsers: 1,
      categories: 1,
      cities: 1,
      jobs: 1,
      applications: 1,
      auditLogs: 1,
    },
  },
  adminUsers: [],
  categories: [],
  cities: [],
  jobs: [],
  applications: [],
  auditLogs: [],
  rateLimits: {},
};

let writeQueue = Promise.resolve();

function enqueue(fn) {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}

async function ensureDataFile() {
  await fs.mkdir(path.dirname(config.dataPath), { recursive: true });
  try {
    await fs.access(config.dataPath);
  } catch {
    await fs.writeFile(config.dataPath, JSON.stringify(EMPTY_DATA, null, 2), 'utf8');
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(config.dataPath, 'utf8');
  return JSON.parse(raw);
}

async function writeData(data) {
  const tmp = `${config.dataPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, config.dataPath);
}

function nextId(data, key) {
  const id = data.meta.nextId[key]++;
  return id;
}

function enrichJob(job, data) {
  const category = data.categories.find((c) => c.id === job.category_id);
  const city = data.cities.find((c) => c.id === job.city_id);
  const applicationCount = data.applications.filter(
    (a) => a.job_id === job.id && a.status === 'verified'
  ).length;
  return {
    ...job,
    category_name: category?.name || '',
    city_name: city?.name || '',
    application_count: applicationCount,
    click_count: job.click_count ?? 0,
  };
}

export const store = {
  async mutate(mutator) {
    return enqueue(async () => {
      const data = await readData();
      const result = await mutator(data);
      await writeData(data);
      return result;
    });
  },

  async read() {
    return readData();
  },

  async exportJson() {
    const data = await readData();
    return JSON.stringify(data, null, 2);
  },

  // Admin users
  async findAdminByEmail(email) {
    const data = await readData();
    return data.adminUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async ensureAdminUser(email, passwordHash) {
    return this.mutate((data) => {
      const existing = data.adminUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) return existing;
      const user = { id: nextId(data, 'adminUsers'), email, password_hash: passwordHash, created_at: nowIso() };
      data.adminUsers.push(user);
      return user;
    });
  },

  // Taxonomy
  async listCategories() {
    const data = await readData();
    return [...data.categories].sort((a, b) => a.name.localeCompare(b.name));
  },

  async listCities() {
    const data = await readData();
    return [...data.cities].sort((a, b) => a.name.localeCompare(b.name));
  },

  async createCategory(name) {
    return this.mutate((data) => {
      if (data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('duplicate');
      }
      const category = { id: nextId(data, 'categories'), name };
      data.categories.push(category);
      return category;
    });
  },

  async updateCategory(id, name) {
    return this.mutate((data) => {
      const category = data.categories.find((c) => c.id === id);
      if (!category) throw new Error('not found');
      if (data.categories.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('duplicate');
      }
      category.name = name;
    });
  },

  async deleteCategory(id) {
    return this.mutate((data) => {
      if (data.jobs.some((j) => j.category_id === id)) throw new Error('in use');
      const before = data.categories.length;
      data.categories = data.categories.filter((c) => c.id !== id);
      if (data.categories.length === before) throw new Error('not found');
    });
  },

  async createCity(name) {
    return this.mutate((data) => {
      if (data.cities.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('duplicate');
      }
      const city = { id: nextId(data, 'cities'), name };
      data.cities.push(city);
      return city;
    });
  },

  async updateCity(id, name) {
    return this.mutate((data) => {
      const city = data.cities.find((c) => c.id === id);
      if (!city) throw new Error('not found');
      if (data.cities.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('duplicate');
      }
      city.name = name;
    });
  },

  async deleteCity(id) {
    return this.mutate((data) => {
      if (data.jobs.some((j) => j.city_id === id)) throw new Error('in use');
      const before = data.cities.length;
      data.cities = data.cities.filter((c) => c.id !== id);
      if (data.cities.length === before) throw new Error('not found');
    });
  },

  async categoriesPagedWithJobCount(limit, offset) {
    const data = await readData();
    const items = data.categories
      .map((c) => ({
        ...c,
        jobs_count: data.jobs.filter((j) => j.category_id === c.id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return items.slice(offset, offset + limit);
  },

  async citiesPagedWithJobCount(limit, offset) {
    const data = await readData();
    const items = data.cities
      .map((c) => ({
        ...c,
        jobs_count: data.jobs.filter((j) => j.city_id === c.id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return items.slice(offset, offset + limit);
  },

  async countCategories() {
    const data = await readData();
    return data.categories.length;
  },

  async countCities() {
    const data = await readData();
    return data.cities.length;
  },

  // Jobs
  async listActive({ categoryId = null, cityId = null, q = '' } = {}) {
    const data = await readData();
    let jobs = data.jobs.filter((j) => j.status === 'active');
    if (categoryId) jobs = jobs.filter((j) => j.category_id === categoryId);
    if (cityId) jobs = jobs.filter((j) => j.city_id === cityId);
    if (q) {
      const needle = q.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(needle) ||
          j.company_name.toLowerCase().includes(needle) ||
          j.description.toLowerCase().includes(needle)
      );
    }
    return jobs
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((j) => enrichJob(j, data));
  },

  async findJobById(id) {
    const data = await readData();
    const job = data.jobs.find((j) => j.id === id);
    return job ? enrichJob(job, data) : null;
  },

  async findJobByIdAndToken(id, ownerToken) {
    const data = await readData();
    const job = data.jobs.find((j) => j.id === id && j.owner_token === ownerToken);
    return job ? enrichJob(job, data) : null;
  },

  async createJob(jobFields) {
    return this.mutate((data) => {
      const now = nowIso();
      const job = {
        id: nextId(data, 'jobs'),
        click_count: 0,
        created_at: now,
        updated_at: now,
        ...jobFields,
      };
      data.jobs.push(job);
      return job.id;
    });
  },

  async updateJobStatus(id, status) {
    return this.mutate((data) => {
      const job = data.jobs.find((j) => j.id === id);
      if (!job) return;
      job.status = status;
      job.updated_at = nowIso();
    });
  },

  async activateAndClearPin(id) {
    return this.mutate((data) => {
      const job = data.jobs.find((j) => j.id === id);
      if (!job) return;
      job.status = 'active';
      job.activation_pin_hash = null;
      job.pin_expires_at = null;
      job.updated_at = nowIso();
    });
  },

  async incrementClickCount(id) {
    return this.mutate((data) => {
      const job = data.jobs.find((j) => j.id === id && j.status === 'active');
      if (!job) return;
      job.click_count = (job.click_count ?? 0) + 1;
      job.updated_at = nowIso();
    });
  },

  async listRandomActive(limit = 5, excludeJobId = null) {
    const data = await readData();
    let jobs = data.jobs.filter((j) => j.status === 'active');
    if (excludeJobId) jobs = jobs.filter((j) => j.id !== excludeJobId);
    const shuffled = jobs.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit).map((j) => enrichJob(j, data));
  },

  async listForAdminPaged(limit, offset) {
    const data = await readData();
    return [...data.jobs]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(offset, offset + limit)
      .map((j) => enrichJob(j, data));
  },

  async countForAdmin() {
    const data = await readData();
    return data.jobs.length;
  },

  async deleteInactiveJob(id) {
    return this.mutate((data) => {
      const job = data.jobs.find((j) => j.id === id && j.status === 'inactive');
      if (!job) return false;
      data.applications = data.applications.filter((a) => a.job_id !== id);
      data.jobs = data.jobs.filter((j) => j.id !== id);
      return true;
    });
  },

  // Applications
  async createApplication(fields) {
    return this.mutate((data) => {
      const application = {
        id: nextId(data, 'applications'),
        resume_path: null,
        created_at: nowIso(),
        ...fields,
      };
      data.applications.push(application);
      return application.id;
    });
  },

  async findApplicationById(id) {
    const data = await readData();
    return data.applications.find((a) => a.id === id) || null;
  },

  async findApplicationByIdAndToken(id, ownerToken) {
    const data = await readData();
    return data.applications.find((a) => a.id === id && a.owner_token === ownerToken) || null;
  },

  async markApplicationVerified(id) {
    return this.mutate((data) => {
      const app = data.applications.find((a) => a.id === id);
      if (!app) return;
      app.status = 'verified';
      app.activation_pin_hash = null;
      app.pin_expires_at = null;
      app.verified_at = nowIso();
    });
  },

  async countVerifiedByJobId(jobId) {
    const data = await readData();
    return data.applications.filter((a) => a.job_id === jobId && a.status === 'verified').length;
  },

  async listApplicationsPaged(limit, offset) {
    const data = await readData();
    return [...data.applications]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(offset, offset + limit)
      .map((a) => {
        const job = data.jobs.find((j) => j.id === a.job_id);
        return { ...a, job_title: job?.title || null };
      });
  },

  async countApplications() {
    const data = await readData();
    return data.applications.length;
  },

  // Audit logs
  async recordAudit(entry) {
    return this.mutate((data) => {
      data.auditLogs.push({
        id: nextId(data, 'auditLogs'),
        created_at: nowIso(),
        ...entry,
      });
    });
  },

  async listAuditPaged(limit, offset) {
    const data = await readData();
    return [...data.auditLogs]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(offset, offset + limit);
  },

  async countAudit() {
    const data = await readData();
    return data.auditLogs.length;
  },

  // Rate limits
  async isRateLimited(action, subjectKey, maxAttempts, windowSeconds) {
    const data = await readData();
    const key = `${action}|${subjectKey}`;
    const entry = data.rateLimits[key];
    if (!entry) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now - entry.window_start_unix >= windowSeconds) return false;
    return entry.attempts >= maxAttempts;
  },

  async recordRateFailure(action, subjectKey, windowSeconds) {
    return this.mutate((data) => {
      const key = `${action}|${subjectKey}`;
      const now = Math.floor(Date.now() / 1000);
      let entry = data.rateLimits[key];
      if (!entry || now - entry.window_start_unix >= windowSeconds) {
        entry = { attempts: 0, window_start_unix: now };
        data.rateLimits[key] = entry;
      }
      entry.attempts += 1;
      entry.updated_at = nowIso();
    });
  },

  async resetRateLimit(action, subjectKey) {
    return this.mutate((data) => {
      delete data.rateLimits[`${action}|${subjectKey}`];
    });
  },
};
