import bcrypt from 'bcryptjs';
import { store } from '../store/dataStore.js';
import { randomPin, randomToken } from '../lib/helpers.js';

export async function createPendingApplication(fields) {
  const pin = randomPin();
  const ownerToken = randomToken();
  const pinExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const id = await store.createApplication({
    ...fields,
    status: 'pending',
    owner_token: ownerToken,
    activation_pin_hash: await bcrypt.hash(pin, 10),
    pin_expires_at: pinExpiresAt,
    verified_at: null,
  });
  return { id, pin, ownerToken };
}

export async function verifyApplicationPin(applicationId, ownerToken, pin) {
  const application = await store.findApplicationByIdAndToken(applicationId, ownerToken);
  if (!application || application.status !== 'pending') return false;
  if (!application.pin_expires_at || Date.parse(application.pin_expires_at) < Date.now()) return false;
  if (!application.activation_pin_hash) return false;
  const valid = await bcrypt.compare(pin, application.activation_pin_hash);
  if (!valid) return false;
  await store.markApplicationVerified(applicationId);
  return true;
}
