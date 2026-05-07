import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PREFIX = 'identity-scrypt';
const SCRYPT_VERSION = '1';
const scryptAsync = promisify(scrypt) as (password: string, salt: string, keyLength: number) => Promise<Buffer>;

@Injectable()
export class IdentityPasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);
    return [SCRYPT_PREFIX, SCRYPT_VERSION, salt, derivedKey.toString('base64url')].join('$');
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const parts = passwordHash.split('$');
    if (parts.length !== 4 || parts[0] !== SCRYPT_PREFIX || parts[1] !== SCRYPT_VERSION) {
      return false;
    }

    const [, , salt, expectedHash] = parts;
    const expected = Buffer.from(expectedHash, 'base64url');
    const actual = await scryptAsync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  }
}
