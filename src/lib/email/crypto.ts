/**
 * Token encryption for LinguaDesk AI email accounts — server-side only.
 *
 * NEVER import this module (or anything that imports it) from a client
 * component: the encryption key must never reach the browser.
 *
 * Scheme: AES-256-GCM via node:crypto. Each encryption uses a fresh
 * random 12-byte IV; the stored value is one base64 string of
 * IV (12 bytes) || auth tag (16 bytes) || ciphertext, so decryption
 * needs nothing but the stored string and the key.
 *
 * Key format (TOKEN_ENCRYPTION_KEY): either 64 hex characters
 * (32 bytes) or 44 base64 characters decoding to exactly 32 bytes.
 * Anything else is refused with a clear error — there is NO fallback
 * to plaintext storage, ever. If the key is missing or invalid, the
 * connect flow must refuse to store tokens and sync/send must refuse
 * to run.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export const ENCRYPTION_KEY_ERROR =
  "Token encryption is not configured — set TOKEN_ENCRYPTION_KEY to 64 hex characters (32 bytes) or 44 base64 characters (32 bytes). No tokens are stored without it.";

const HEX_64_RE = /^[0-9a-fA-F]{64}$/;
const BASE64_44_RE = /^[A-Za-z0-9+/]{43}=$|^[A-Za-z0-9+/]{44}$/;

/**
 * Parse a raw TOKEN_ENCRYPTION_KEY value into 32 key bytes, or null
 * when the format is wrong. Accepts 64 hex chars or base64 that
 * decodes to exactly 32 bytes (44 chars with padding, or 43 without).
 * Pure function — no env access — so it can be unit-tested directly.
 */
export function parseEncryptionKey(raw: string | undefined | null): Buffer | null {
  if (!raw) return null;
  const value = raw.trim();
  if (HEX_64_RE.test(value)) {
    return Buffer.from(value, "hex");
  }
  if (BASE64_44_RE.test(value) || /^[A-Za-z0-9+/=_-]{43,44}$/.test(value)) {
    try {
      const decoded = Buffer.from(value, "base64");
      if (decoded.length === 32) return decoded;
    } catch {
      return null;
    }
  }
  return null;
}

/** The configured key, or an error explaining it is missing/invalid. */
export function getEncryptionKey(): { key: Buffer | null; error: string | null } {
  const key = parseEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY);
  if (!key) return { key: null, error: ENCRYPTION_KEY_ERROR };
  return { key, error: null };
}

/** True only when TOKEN_ENCRYPTION_KEY parses to 32 bytes. */
export function isEncryptionConfigured(): boolean {
  return parseEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY) !== null;
}

/**
 * Encrypt one token. Returns `{ data, error }` and never throws.
 * Fails (data null) when the encryption key is missing/invalid.
 */
export function encryptToken(plaintext: string): { data: string | null; error: string | null } {
  const { key, error } = getEncryptionKey();
  if (!key || error) return { data: null, error };
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { data: Buffer.concat([iv, tag, ciphertext]).toString("base64"), error: null };
  } catch {
    return { data: null, error: "Could not encrypt the token." };
  }
}

/**
 * Decrypt a value produced by encryptToken(). Returns `{ data, error }`
 * and never throws. A wrong key, a truncated value, or a tampered
 * value all fail closed (the GCM auth tag will not verify).
 */
export function decryptToken(ciphertext: string): { data: string | null; error: string | null } {
  const { key, error } = getEncryptionKey();
  if (!key || error) return { data: null, error };
  try {
    const raw = Buffer.from(ciphertext, "base64");
    if (raw.length < 12 + 16 + 1) {
      return { data: null, error: "Stored token is too short to decrypt." };
    }
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return { data: plaintext, error: null };
  } catch {
    return { data: null, error: "Could not decrypt the stored token (wrong key or corrupted value)." };
  }
}
