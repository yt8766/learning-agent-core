import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { UserProfileRecord } from '../index';

export interface UserProfileRepository {
  getById(userId: string): Promise<UserProfileRecord | undefined>;
  patch(
    userId: string,
    patch: Partial<UserProfileRecord> & Pick<UserProfileRecord, 'updatedAt'>
  ): Promise<UserProfileRecord>;
  list(): Promise<UserProfileRecord[]>;
}

export class FileUserProfileRepository implements UserProfileRepository {
  constructor(private readonly filePath: string) {
    this.filePath = resolve(filePath);
  }

  async getById(userId: string): Promise<UserProfileRecord | undefined> {
    const profiles = await this.list();
    return profiles.find(item => item.userId === userId || item.id === userId);
  }

  async patch(
    userId: string,
    patch: Partial<UserProfileRecord> & Pick<UserProfileRecord, 'updatedAt'>
  ): Promise<UserProfileRecord> {
    const profiles = await this.list();
    const index = profiles.findIndex(item => item.userId === userId || item.id === userId);
    const current = index >= 0 ? profiles[index] : undefined;
    const { updatedAt, ...patchFields } = patch;
    const next: UserProfileRecord = {
      ...current,
      ...patchFields,
      id: current?.id ?? userId,
      userId: current?.userId ?? userId,
      scopeType: current?.scopeType ?? 'user',
      doNotDo: patchFields.doNotDo ?? current?.doNotDo ?? [],
      privacyFlags: patchFields.privacyFlags ?? current?.privacyFlags ?? [],
      createdAt: current?.createdAt ?? updatedAt,
      updatedAt
    };

    if (index >= 0) {
      profiles[index] = next;
    } else {
      profiles.push(next);
    }

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(profiles, null, 2), 'utf8');
    return next;
  }

  async list(): Promise<UserProfileRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as UserProfileRecord[]) : [];
    } catch {
      return [];
    }
  }
}
