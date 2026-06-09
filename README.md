# Chirp Jobs

> Open-source standalone job board — Node.js, JSON storage, no database.

Post job listings, collect verified applications, and moderate content from a simple admin dashboard.

No database required. Configure the board via environment variables in `.env`.

Built for freelance recruiters, small companies, community job boards, and conference or event hiring pages.

**[Watch the video demo](https://drive.proton.me/urls/JWSMWJQ1F4#HKYh2r3ED9JK)**

## Features

- Public job listings with search and category/location filters
- Job posting with email PIN activation (instant publish for logged-in admins)
- Candidate apply flow with PIN verification
- Admin dashboard: jobs, applications, categories, cities, audit trail, emails
- JSON data backup download
- Rate limiting on login and PIN verification
- Theme options: professional-blue, indigo-teal, emerald-slate
- Plain Node.js `http` server with static HTML + JSON API (no framework or build step)
- Lightweight custom CSS UI with [Lucide](https://lucide.dev) icons via CDN (no Bootstrap or build step)

## Quick start

```bash
cd chirp-jobs
npm install
cp .env.example .env          # optional — edit settings
npm run seed                  # optional — admin user + sample data
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Or use Make:

```bash
make help      # list all commands
make setup     # .env + npm install
make seed      # sample data + admin user
make start     # background server
make stop
make restart
make status
make dev       # foreground with file watch
```

Default admin (from `.env`):

- Email: `admin@example.com`
- Password: `admin`

## Configuration

Copy `.env.example` to `.env` and edit as needed.

| Variable | Description |
| -------- | ----------- |
| `APP_NAME` | App title |
| `APP_URL` | Public site URL (used in email activation links) |
| `APP_ENV` | `development`, `production`, or `demo` |
| `APP_THEME` | `professional-blue`, `indigo-teal`, or `emerald-slate` |
| `PORT` | Server port (default: `3000`) |
| `SESSION_SECRET` | Session signing secret (change in production) |
| `DATA_PATH` | Path to JSON data file (default: `storage/data.json`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap admin account (`npm run seed`) |
| `JOB_DEFAULT_COMPANY_NAME` | Pre-fill company on job post form |
| `JOB_DEFAULT_CONTACT_EMAIL` | Pre-fill contact email on job post form |
| `SMTP_ENABLED` | Set `true` to send real email |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | SMTP settings |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` | Outbound sender |
| `SECURITY_LOGIN_MAX_ATTEMPTS` | Admin login rate limit |
| `SECURITY_PIN_MAX_ATTEMPTS` | PIN verification rate limit |

When `SMTP_ENABLED=false`, outbound mail is saved to `storage/mail_archive/` and viewable in **Admin → Emails**.

## Data

All records live in a single JSON file (`storage/data.json` by default):

| Key | Contents |
| --- | -------- |
| `adminUsers` | Admin accounts |
| `categories` / `cities` | Taxonomy |
| `jobs` | Job listings |
| `applications` | Candidate applications |
| `auditLogs` | Admin and public action log |
| `rateLimits` | Login and PIN throttling state |

Download a backup anytime from **Admin → Data**.

## Deployment

Host on [Railway](https://railway.com/?referralCode=iNLSQG) with a persistent volume for `storage/`. See [DEPLOY.md](DEPLOY.md) for the full setup guide.

For a VPS or shared host: `npm install --omit=dev`, `npm run seed` once, then `npm start` or a process manager (PM2, systemd). Back up `storage/data.json` regularly.

## Consulting and Customization

Need custom workflows, features, or integrations?

Contact us at:

**[parrotplaylabs@protonmail.com](mailto:parrotplaylabs@protonmail.com)**

## License

MIT — see [LICENSE.md](LICENSE.md).
