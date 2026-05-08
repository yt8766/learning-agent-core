export interface OssPutObjectInput {
  objectKey: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface OssStoredObject {
  objectKey: string;
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
}

export interface OssListObjectsInput {
  marker?: string;
  maxKeys?: number;
  prefix?: string;
}

export interface OssListedObject {
  objectKey: string;
  lastModified?: string;
  size?: number;
}

export interface OssListObjectsResult {
  items: OssListedObject[];
  isTruncated: boolean;
  nextMarker?: string;
}

export interface OssPutObjectResult {
  objectKey: string;
  ossUrl: string;
}

export interface OssStorageProvider {
  putObject(input: OssPutObjectInput): Promise<OssPutObjectResult>;
  getObject(objectKey: string): Promise<OssStoredObject | undefined>;
  deleteObject(objectKey: string): Promise<void>;
  listObjects(input?: OssListObjectsInput): Promise<OssListObjectsResult>;
}
