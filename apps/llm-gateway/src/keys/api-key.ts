import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_PREFIX = 'sk-llmgw_';
const STORED_PREFIX_LENGTH = 16;

export interface CreatedVirtualApiKey {
  plaintext: string;
  prefix: string;
  hash: string;
}

export async function createVirtualApiKey(secret: string): Promise<CreatedVirtualApiKey> {
  const plaintext = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;

  return {
    plaintext,
    prefix: plaintext.slice(0, STORED_PREFIX_LENGTH),
    hash: hashVirtualApiKey(plaintext, secret)
  };
}

export async function verifyVirtualApiKey(plaintext: string, hash: string, secret: string): Promise<boolean> {
  if (!plaintext.startsWith(KEY_PREFIX) || hash.length === 0) {
    return false;
  }

  const candidate = hashVirtualApiKey(plaintext, secret);
  const expected = Buffer.from(hash);
  const actual = Buffer.from(candidate);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashVirtualApiKey(plaintext: string, secret: string): string {
  return createHmac('sha256', secret).update(plaintext).digest('hex');
}
