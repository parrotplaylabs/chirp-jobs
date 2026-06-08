import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootPath, '.env') });

export const config = {
  rootPath,
  appName: process.env.APP_NAME || 'Chirp Jobs',
  appEnv: process.env.APP_ENV || 'development',
  appDebug: process.env.APP_DEBUG === 'true',
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  appTheme: ['professional-blue', 'indigo-teal', 'emerald-slate'].includes(process.env.APP_THEME)
    ? process.env.APP_THEME
    : 'professional-blue',
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || 'chirpjobs-dev-secret-change-me',
  dataPath: path.resolve(rootPath, process.env.DATA_PATH || 'storage/data.json'),
  mailArchivePath: path.join(rootPath, 'storage/mail_archive'),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  jobDefaultCompanyName: process.env.JOB_DEFAULT_COMPANY_NAME || '',
  jobDefaultContactEmail: process.env.JOB_DEFAULT_CONTACT_EMAIL || '',
  smtp: {
    enabled: process.env.SMTP_ENABLED === 'true',
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    encryption: process.env.SMTP_ENCRYPTION || 'tls',
  },
  mailFrom: {
    address: process.env.MAIL_FROM_ADDRESS || 'no-reply@chirpjobs.local',
    name: process.env.MAIL_FROM_NAME || 'Chirp Jobs',
  },
  security: {
    loginMaxAttempts: Number(process.env.SECURITY_LOGIN_MAX_ATTEMPTS || 10),
    loginWindowSeconds: Number(process.env.SECURITY_LOGIN_WINDOW_SECONDS || 900),
    pinMaxAttempts: Number(process.env.SECURITY_PIN_MAX_ATTEMPTS || 8),
    pinWindowSeconds: Number(process.env.SECURITY_PIN_WINDOW_SECONDS || 900),
  },
};
