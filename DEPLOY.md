# Deploying Chirp Jobs

This guide covers hosting on [Railway](https://railway.com/?referralCode=iNLSQG) with persistent storage.

## Prerequisites

- GitHub repo with this project
- Railway account

## Steps

1. **New project → Deploy from GitHub** — select your `chirp-jobs` repo.

2. **Set environment variables** (Settings → Variables):

   ```
   APP_URL=https://your-app.up.railway.app
   APP_ENV=production
   SESSION_SECRET=<long-random-string>
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=<strong-password>
   SMTP_ENABLED=true
   SMTP_HOST=smtp.yourprovider.com
   SMTP_PORT=587
   SMTP_USERNAME=...
   SMTP_PASSWORD=...
   MAIL_FROM_ADDRESS=no-reply@yourdomain.com
   ```

   Set `JOB_DEFAULT_COMPANY_NAME` and `JOB_DEFAULT_CONTACT_EMAIL` if you run a branded board for one organization.

3. **Add a volume** — mount at `/app/storage` so `data.json` and mail archives survive redeploys.

4. **Redeploy.** Run the seed command once from the Railway shell if you need the admin user and sample categories:

   ```bash
   node scripts/seed.js
   ```

5. **Verify** — open the public URL, sign in at `/admin/login`, and confirm jobs and categories load.

## Data persistence

- Git push does **not** sync live job data to Railway.
- Use **Admin → Data → Download data** periodically for off-site backup.
- Restore by replacing `storage/data.json` on the volume (stop the app first, or upload via shell).

## Email

- With `SMTP_ENABLED=false`, PIN emails are written to `storage/mail_archive/` only — fine for dev, not production.
- Set `APP_URL` to your public HTTPS URL so activation links in emails are correct.

## Security

- Change `ADMIN_PASSWORD` and `SESSION_SECRET` before going live.
- Use HTTPS in production (`APP_URL` should use `https://`).
- Enable SMTP so job posters and applicants receive real PIN emails.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Data wiped on redeploy | Volume not mounted at `/app/storage` |
| PIN emails not received | `SMTP_ENABLED` false or wrong SMTP credentials; check Admin → Emails for archives |
| Activation links broken | `APP_URL` missing or still set to `localhost` |
| Permission errors on storage | Ensure the volume is writable by the Node process |
