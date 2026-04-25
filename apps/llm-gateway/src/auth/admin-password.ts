import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(pbkdf2);
const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 210_000;
const PASSWORD_HASH_BYTES = 32;

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const key = await deriveKey(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_BYTES, 'sha256');
  return [PASSWORD_HASH_PREFIX, String(PASSWORD_HASH_ITERATIONS), salt, Buffer.from(key).toString('base64url')].join(
    '$'
  );
}

export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, iterationsText, salt, hash] = storedHash.split('$');
  if (prefix !== PASSWORD_HASH_PREFIX || !iterationsText || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const expected = Buffer.from(hash, 'base64url');
  const actual = await deriveKey(password, salt, iterations, expected.length, 'sha256');
  const actualBuffer = Buffer.from(actual);

  return expected.length === actualBuffer.length && timingSafeEqual(expected, actualBuffer);
}
