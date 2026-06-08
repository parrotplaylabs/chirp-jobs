import bcrypt from 'bcryptjs';
import { store } from '../store/dataStore.js';
import { randomPin, randomToken } from '../lib/helpers.js';

export async function createActiveJob(fields) {
  return store.createJob({
    ...fields,
    status: 'active',
    owner_token: randomToken(),
    activation_pin_hash: null,
    pin_expires_at: null,
  });
}

export async function createPendingJob(fields) {
  const pin = randomPin();
  const ownerToken = randomToken();
  const pinExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const id = await store.createJob({
    ...fields,
    status: 'pending',
    owner_token: ownerToken,
    activation_pin_hash: await bcrypt.hash(pin, 10),
    pin_expires_at: pinExpiresAt,
  });
  return { id, pin, ownerToken };
}

export async function verifyJobPin(id, ownerToken, pin) {
  const job = await store.findJobByIdAndToken(id, ownerToken);
  if (!job || job.status !== 'pending') return false;
  if (!job.pin_expires_at || Date.parse(job.pin_expires_at) < Date.now()) return false;
  if (!job.activation_pin_hash) return false;
  const valid = await bcrypt.compare(pin, job.activation_pin_hash);
  if (!valid) return false;
  await store.activateAndClearPin(id);
  return true;
}
