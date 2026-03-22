/**
 * Optional app-layer encryption helpers (server-only).
 * Primary encryption path is `upsert_contact_encrypted` + Vault in Postgres.
 * Use `SUPABASE_ENCRYPTION_KEY` only if you add Node-side encrypt/decrypt paths.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer | null {
  const raw = process.env.SUPABASE_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 16) return null;
  return scryptSync(raw, 'wayfarer-salt', 32);
}

/** Encrypt UTF-8 string → base64(iv+ciphertext+tag). Returns original if no key configured. */
export function encryptField(value: string): string {
  const key = getKey();
  if (!key || !value) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptField(payload: string): string {
  const key = getKey();
  if (!key || !payload) return payload;
  try {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < 12 + 16) return payload;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return payload;
  }
}
