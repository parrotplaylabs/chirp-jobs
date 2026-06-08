import bcrypt from 'bcryptjs';
import { store } from '../store/dataStore.js';

export async function authenticate(email, password) {
  const admin = await store.findAdminByEmail(email);
  if (!admin) return null;
  const valid = await bcrypt.compare(password, admin.password_hash);
  return valid ? admin : null;
}
