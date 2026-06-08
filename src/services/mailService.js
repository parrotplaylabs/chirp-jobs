import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { nowIso } from '../lib/helpers.js';

async function ensureArchiveDir() {
  await fs.mkdir(config.mailArchivePath, { recursive: true });
}

export async function sendMail(to, subject, body, isHtml = false) {
  const mailOptions = {
    from: `"${config.mailFrom.name}" <${config.mailFrom.address}>`,
    to,
    subject,
    [isHtml ? 'html' : 'text']: body,
  };

  if (config.smtp.enabled) {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.encryption === 'ssl',
      auth: config.smtp.username
        ? { user: config.smtp.username, pass: config.smtp.password }
        : undefined,
      tls: config.smtp.encryption === 'tls' ? { rejectUnauthorized: true } : undefined,
    });
    await transporter.sendMail(mailOptions);
    return;
  }

  await ensureArchiveDir();
  const fileName = `${nowIso().replace(/[:.]/g, '-')}_${Math.random().toString(16).slice(2, 10)}.eml`;
  const filePath = path.join(config.mailArchivePath, fileName);
  const mime = [
    `To: ${to}`,
    `From: ${mailOptions.from}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
    '',
    body,
  ].join('\r\n');
  await fs.writeFile(filePath, mime, 'utf8');
}

export async function listArchivedEmails() {
  await ensureArchiveDir();
  const files = await fs.readdir(config.mailArchivePath);
  const emails = [];

  for (const file of files) {
    if (!file.endsWith('.eml')) continue;
    const filePath = path.join(config.mailArchivePath, file);
    const raw = await fs.readFile(filePath, 'utf8');
    const toMatch = raw.match(/^To:\s*(.+)$/m);
    const subjectMatch = raw.match(/^Subject:\s*(.+)$/m);
    const dateMatch = raw.match(/^Date:\s*(.+)$/m);
    emails.push({
      file,
      recipient: toMatch?.[1]?.trim() || '',
      subject: subjectMatch?.[1]?.trim() || '(no subject)',
      date: dateMatch?.[1] ? new Date(dateMatch[1]).toISOString() : (await fs.stat(filePath)).mtime.toISOString(),
      isHtml: /Content-Type:\s*text\/html/i.test(raw),
    });
  }

  return emails.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export async function getArchivedEmail(file) {
  if (file.includes('/') || file.includes('..')) return null;
  const filePath = path.join(config.mailArchivePath, file);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parts = raw.split(/\r?\n\r?\n/);
    const body = parts.slice(1).join('\n\n');
    const subjectMatch = raw.match(/^Subject:\s*(.+)$/m);
    const toMatch = raw.match(/^To:\s*(.+)$/m);
    return {
      file,
      subject: subjectMatch?.[1]?.trim() || '',
      recipient: toMatch?.[1]?.trim() || '',
      body,
      isHtml: /Content-Type:\s*text\/html/i.test(raw),
    };
  } catch {
    return null;
  }
}
