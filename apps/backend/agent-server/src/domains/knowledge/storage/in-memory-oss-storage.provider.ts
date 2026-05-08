import { Injectable } from '@nestjs/common';

import type {
  OssListObjectsInput,
  OssListObjectsResult,
  OssPutObjectInput,
  OssPutObjectResult,
  OssStorageProvider,
  OssStoredObject
} from './oss-storage.provider';

@Injectable()
export class InMemoryOssStorageProvider implements OssStorageProvider {
  private readonly objects = new Map<string, OssStoredObject>();

  async putObject(input: OssPutObjectInput): Promise<OssPutObjectResult> {
    this.objects.set(input.objectKey, {
      objectKey: input.objectKey,
      body: Buffer.from(input.body),
      contentType: input.contentType,
      metadata: input.metadata ?? {}
    });
    return {
      objectKey: input.objectKey,
      ossUrl: `oss://memory/${input.objectKey}`
    };
  }

  async getObject(objectKey: string): Promise<OssStoredObject | undefined> {
    const object = this.objects.get(objectKey);
    return object
      ? {
          ...object,
          body: Buffer.from(object.body),
          metadata: { ...object.metadata }
        }
      : undefined;
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }

  async listObjects(input: OssListObjectsInput = {}): Promise<OssListObjectsResult> {
    const maxKeys = input.maxKeys ?? Number.POSITIVE_INFINITY;
    const keys = this.keys()
      .filter(key => !input.prefix || key.startsWith(input.prefix))
      .filter(key => !input.marker || key > input.marker)
      .sort();
    const page = keys.slice(0, maxKeys);
    return {
      items: page.map(objectKey => ({
        objectKey,
        size: this.objects.get(objectKey)?.body.byteLength
      })),
      isTruncated: keys.length > page.length,
      nextMarker: keys.length > page.length ? page.at(-1) : undefined
    };
  }

  keys(): string[] {
    return [...this.objects.keys()];
  }
}
