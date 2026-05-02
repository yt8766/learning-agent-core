import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordHasherProvider {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, salt, expectedHex] = passwordHash.split(':');
    if (algorithm !== 'scrypt' || !salt || !expectedHex) {
      return false;
    }

    const expected = Buffer.from(expectedHex, 'hex');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
