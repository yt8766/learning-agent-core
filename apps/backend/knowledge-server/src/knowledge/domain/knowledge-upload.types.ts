export type KnowledgeUploadContentType = 'text/markdown' | 'text/plain';

export interface UploadedKnowledgeFile {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
}

export interface KnowledgeUploadRecord {
  uploadId: string;
  knowledgeBaseId: string;
  filename: string;
  size: number;
  contentType: KnowledgeUploadContentType;
  objectKey: string;
  ossUrl: string;
  uploadedByUserId: string;
  uploadedAt: string;
}

export type KnowledgeUploadResult = Omit<KnowledgeUploadRecord, 'uploadedByUserId'>;
