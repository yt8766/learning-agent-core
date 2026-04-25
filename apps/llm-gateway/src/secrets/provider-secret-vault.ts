import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'AES-256-GCM';
const IV_BYTES = 12;

export interface ProviderSecretVaultOptions {
  key: string | Buffer;
  keyVersion: string;
}

export interface EncryptedProviderSecretPayload {
  algorithm: typeof ALGORITHM;
  keyVersion: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export class ProviderSecretVault {
  private readonly encryptionKey: Buffer;
  private readonly keyVersion: string;

  constructor(options: ProviderSecretVaultOptions) {
    this.encryptionKey = normalizeKey(options.key);
    this.keyVersion = normalizeKeyVersion(options.keyVersion);
  }

  encrypt(plaintext: string): EncryptedProviderSecretPayload {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      algorithm: ALGORITHM,
      keyVersion: this.keyVersion,
      iv: iv.toString('base64url'),
      tag: tag.toString('base64url'),
      ciphertext: ciphertext.toString('base64url')
    };
  }

  decrypt(payload: EncryptedProviderSecretPayload): string {
    if (payload.algorithm !== ALGORITHM) {
      throw new Error('Provider secret algorithm mismatch');
    }
    if (payload.keyVersion !== this.keyVersion) {
      throw new Error('Provider secret key version mismatch');
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(payload.iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));

      return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64url')), decipher.final()]).toString(
        'utf8'
      );
    } catch {
      throw new Error('Provider secret payload could not be decrypted');
    }
  }

  fingerprint(secret: string): string {
    return `hmac-sha256:${createHmac('sha256', this.encryptionKey).update(secret, 'utf8').digest('hex')}`;
  }
}

function normalizeKey(key: string | Buffer): Buffer {
  const rawKey = Buffer.isBuffer(key) ? key : Buffer.from(key, 'utf8');

  if (rawKey.length < 32) {
    throw new Error('Provider secret vault key must contain at least 32 bytes');
  }

  return createHash('sha256').update(rawKey).digest();
}

function normalizeKeyVersion(keyVersion: string): string {
  const normalized = keyVersion.trim();

  if (normalized.length === 0) {
    throw new Error('Provider secret key version is required');
  }

  return normalized;
}
