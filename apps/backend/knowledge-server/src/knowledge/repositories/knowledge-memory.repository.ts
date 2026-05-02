import { Injectable } from '@nestjs/common';
import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest
} from '@agent/core';

import type {
  DocumentChunkRecord,
  DocumentProcessingJobRecord,
  KnowledgeDocumentRecord
} from '../domain/knowledge-document.types';
import type { KnowledgeUploadRecord } from '../domain/knowledge-upload.types';
import type { KnowledgeRepository } from './knowledge.repository';

@Injectable()
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly bases = new Map<string, KnowledgeBase>();
  private readonly members = new Map<string, KnowledgeBaseMember>();
  private readonly uploads = new Map<string, KnowledgeUploadRecord>();
  private readonly documents = new Map<string, KnowledgeDocumentRecord>();
  private readonly jobs = new Map<string, DocumentProcessingJobRecord>();
  private readonly chunks = new Map<string, DocumentChunkRecord[]>();

  async createBase(
    input: KnowledgeBaseCreateRequest & { id: string; createdByUserId: string }
  ): Promise<KnowledgeBase> {
    const now = new Date().toISOString();
    const base: KnowledgeBase = {
      id: input.id,
      name: input.name,
      description: input.description ?? '',
      createdByUserId: input.createdByUserId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    this.bases.set(base.id, base);
    await this.addMember({ knowledgeBaseId: base.id, userId: input.createdByUserId, role: 'owner' });
    return base;
  }

  async listBasesForUser(userId: string): Promise<KnowledgeBase[]> {
    const baseIds = [...this.members.values()]
      .filter(member => member.userId === userId)
      .map(member => member.knowledgeBaseId);
    return baseIds.map(baseId => this.bases.get(baseId)).filter((base): base is KnowledgeBase => Boolean(base));
  }

  async findBase(baseId: string): Promise<KnowledgeBase | undefined> {
    return this.bases.get(baseId);
  }

  async addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember> {
    const now = new Date().toISOString();
    const member: KnowledgeBaseMember = {
      knowledgeBaseId: input.knowledgeBaseId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now
    };
    this.members.set(`${member.knowledgeBaseId}:${member.userId}`, member);
    return member;
  }

  async findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined> {
    return this.members.get(`${baseId}:${userId}`);
  }

  async listMembers(baseId: string): Promise<KnowledgeBaseMember[]> {
    return [...this.members.values()].filter(member => member.knowledgeBaseId === baseId);
  }

  async saveUpload(input: KnowledgeUploadRecord): Promise<KnowledgeUploadRecord> {
    this.uploads.set(input.uploadId, { ...input });
    return { ...input };
  }

  async findUpload(uploadId: string): Promise<KnowledgeUploadRecord | undefined> {
    const upload = this.uploads.get(uploadId);
    return upload ? { ...upload } : undefined;
  }

  async createDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    this.documents.set(input.id, cloneDocument(input));
    return cloneDocument(input);
  }

  async updateDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    this.documents.set(input.id, cloneDocument(input));
    return cloneDocument(input);
  }

  async findDocument(documentId: string): Promise<KnowledgeDocumentRecord | undefined> {
    const document = this.documents.get(documentId);
    return document ? cloneDocument(document) : undefined;
  }

  async deleteDocument(documentId: string): Promise<void> {
    this.documents.delete(documentId);
    this.jobs.forEach((job, jobId) => {
      if (job.documentId === documentId) {
        this.jobs.delete(jobId);
      }
    });
    this.chunks.delete(documentId);
  }

  async listDocumentsForBase(baseId: string): Promise<KnowledgeDocumentRecord[]> {
    return [...this.documents.values()].filter(document => document.knowledgeBaseId === baseId).map(cloneDocument);
  }

  async createJob(input: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord> {
    this.jobs.set(input.id, cloneJob(input));
    return cloneJob(input);
  }

  async updateJob(input: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord> {
    this.jobs.set(input.id, cloneJob(input));
    return cloneJob(input);
  }

  async findLatestJobForDocument(documentId: string): Promise<DocumentProcessingJobRecord | undefined> {
    const jobs = [...this.jobs.values()]
      .reverse()
      .filter(job => job.documentId === documentId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return jobs[0] ? cloneJob(jobs[0]) : undefined;
  }

  async saveChunks(documentId: string, chunks: DocumentChunkRecord[]): Promise<DocumentChunkRecord[]> {
    const copies = chunks.map(cloneChunk);
    this.chunks.set(documentId, copies);
    return copies.map(cloneChunk);
  }

  async listChunks(documentId: string): Promise<DocumentChunkRecord[]> {
    return (this.chunks.get(documentId) ?? []).map(cloneChunk);
  }
}

function cloneDocument(document: KnowledgeDocumentRecord): KnowledgeDocumentRecord {
  return { ...document, metadata: { ...document.metadata } };
}

function cloneJob(job: DocumentProcessingJobRecord): DocumentProcessingJobRecord {
  return { ...job, stages: job.stages.map(stage => ({ ...stage })) };
}

function cloneChunk(chunk: DocumentChunkRecord): DocumentChunkRecord {
  return { ...chunk };
}
