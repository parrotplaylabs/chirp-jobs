import crypto from 'node:crypto';

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'job';
}

export function jobPath(job) {
  const id = job.id ?? 0;
  const base = `${job.title || ''}-${job.company_name || ''}`.replace(/^-+|-+$/g, '');
  return `/jobs/${id}/${slugify(base)}`;
}

export function timeAgo(dateTime) {
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

export function friendlyDate(dateTime) {
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

export function buildAbsoluteUrl(baseUrl, path) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
