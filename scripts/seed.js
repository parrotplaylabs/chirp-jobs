import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { nowIso } from '../src/lib/helpers.js';
import { store } from '../src/store/dataStore.js';

const categories = [
  'Engineering',
  'Design',
  'Product',
  'Marketing',
  'Sales',
  'Customer Success',
  'Data',
  'Operations',
];

const cities = ['Remote', 'New York', 'London', 'Manila', 'San Francisco', 'Berlin', 'Singapore', 'Sydney'];

const jobs = [
  ['Senior Frontend Engineer', 'Chirp Labs', 'Remote', 'Engineering'],
  ['Backend Engineer (Node.js)', 'PixelNest', 'London', 'Engineering'],
  ['DevOps Engineer', 'CloudHarbor', 'Berlin', 'Engineering'],
  ['QA Automation Engineer', 'TestMint', 'Manila', 'Engineering'],
  ['Mobile Engineer (iOS)', 'Feather Studio', 'Singapore', 'Engineering'],
  ['Product Designer', 'Northstar UX', 'New York', 'Design'],
  ['UX Researcher', 'Design Atlas', 'Remote', 'Design'],
  ['Visual Designer', 'Palette House', 'Sydney', 'Design'],
  ['Product Manager', 'OrbitWorks', 'San Francisco', 'Product'],
  ['Technical Product Manager', 'BuildFlow', 'London', 'Product'],
  ['Growth Marketing Manager', 'ScaleBird', 'Remote', 'Marketing'],
  ['Content Marketing Lead', 'StoryLoop', 'Berlin', 'Marketing'],
  ['SEO Specialist', 'SignalPath', 'New York', 'Marketing'],
  ['Account Executive', 'HireStack', 'Singapore', 'Sales'],
  ['Sales Development Rep', 'Pipeline Pro', 'Manila', 'Sales'],
  ['Customer Success Manager', 'CareCloud', 'Remote', 'Customer Success'],
  ['Support Specialist', 'HelpNest', 'Sydney', 'Customer Success'],
  ['Data Analyst', 'MetricFox', 'London', 'Data'],
  ['Business Intelligence Engineer', 'QueryForge', 'San Francisco', 'Data'],
  ['Operations Manager', 'OpsPilot', 'New York', 'Operations'],
  ['People Operations Specialist', 'CultureCo', 'Remote', 'Operations'],
  ['Revenue Operations Analyst', 'RevGrid', 'Berlin', 'Operations'],
];

const names = [
  'Avery Cruz',
  'Jordan Smith',
  'Taylor Nguyen',
  'Morgan Reyes',
  'Casey Patel',
  'Riley Santos',
  'Quinn Lim',
  'Jamie Hall',
  'Skyler Diaz',
  'Parker Lee',
];

async function seed() {
  const hash = await bcrypt.hash(config.adminPassword, 10);
  await store.ensureAdminUser(config.adminEmail, hash);

  for (const name of categories) {
    try {
      await store.createCategory(name);
    } catch {
      // already exists
    }
  }

  for (const name of cities) {
    try {
      await store.createCity(name);
    } catch {
      // already exists
    }
  }

  const categoryList = await store.listCategories();
  const cityList = await store.listCities();
  const categoryMap = Object.fromEntries(categoryList.map((c) => [c.name, c.id]));
  const cityMap = Object.fromEntries(cityList.map((c) => [c.name, c.id]));

  const data = await store.read();
  let createdJobs = 0;

  for (const [index, [title, company, location, categoryName]] of jobs.entries()) {
    const exists = data.jobs.some((j) => j.title === title && j.company_name === company);
    if (exists) continue;

    await store.createJob({
      title,
      company_name: company,
      location,
      description: `Join ${company} as a ${title} and help us build a better hiring experience.`,
      how_to_apply: 'Submit your resume and a short note about why this role is a fit.',
      contact_email: config.adminEmail,
      category_id: categoryMap[categoryName] || categoryMap.Engineering,
      city_id: cityMap[location] || cityMap.Remote,
      status: 'active',
      owner_token: `demo-token-${index + 1}`,
      activation_pin_hash: null,
      pin_expires_at: null,
    });
    createdJobs += 1;
  }

  const refreshed = await store.read();
  let applicationCount = refreshed.applications.length;

  if (applicationCount < 30) {
    let created = 0;
    for (const job of refreshed.jobs) {
      for (let i = 0; i < 2; i += 1) {
        const name = names[(created + i) % names.length];
        await store.createApplication({
          job_id: job.id,
          full_name: name,
          email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
          message: `Hello, I am interested in the ${job.title} role. I have relevant experience and would love to discuss.`,
          status: 'verified',
          owner_token: '',
          activation_pin_hash: null,
          pin_expires_at: null,
          verified_at: nowIso(),
        });
        created += 1;
        if (created >= 40) break;
      }
      if (created >= 40) break;
    }
  }

  const finalData = await store.read();
  console.log(
    `Seed complete. Jobs: ${finalData.jobs.length}, Applications: ${finalData.applications.length}, New jobs added: ${createdJobs}`
  );
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
