import { URL } from 'url';
import { parseBody } from './body.js';
import { ensureSession, loadSession } from './session.js';

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket.remoteAddress || '0.0.0.0';
}

export async function buildRequest(incoming) {
  const url = new URL(incoming.url || '/', 'http://localhost');
  const req = {
    method: incoming.method || 'GET',
    url: incoming.url || '/',
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: incoming.headers,
    ip: clientIp(incoming),
    session: {},
    sessionId: null,
    params: {},
    body: {},
  };

  const loaded = loadSession(incoming);
  req.sessionId = loaded.sessionId;
  req.session = loaded.session;

  if (req.method === 'POST') {
    req.body = await parseBody(incoming);
  }

  return req;
}

export function attachSession(req, res) {
  ensureSession(req, res);
}
