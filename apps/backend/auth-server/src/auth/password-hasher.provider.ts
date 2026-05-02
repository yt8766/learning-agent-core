import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class PasswordHasherProvider {
  async hash(password: string): Promise<string> {
    return hash(password, BCRYPT_SALT_ROUNDS);
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    if (!passwordHash.startsWith('$2')) {
      return false;
    }

    return compare(password, passwordHash);
  }
}
