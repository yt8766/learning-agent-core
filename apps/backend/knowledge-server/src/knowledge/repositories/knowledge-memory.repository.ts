import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type {
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseMember,
  KnowledgeBaseMemberCreateRequest
} from '@agent/core';

import type {
  CreateKnowledgeChatMessageRecordInput,
  DocumentChunkRecord,
  DocumentProcessingJobRecord,
  KnowledgeChatConversationRecord,
  KnowledgeChatMessageRecord,
  KnowledgeDocumentRecord
} from '../domain/knowledge-document.types';
import type { KnowledgeUploadRecord } from '../domain/knowledge-upload.types';
import { CreateKnowledgeChatMessageRecordInputSchema } from '../domain/knowledge-document.schemas';
import type { KnowledgeRepository } from './knowledge.repository';

@Injectable()
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly bases = new Map<string, KnowledgeBase>();
  private readonly members = new Map<string, KnowledgeBaseMember>();
  private readonly uploads = new Map<string, KnowledgeUploadRecord>();
  private readonly documents = new Map<string, KnowledgeDocumentRecord>();
  private readonly jobs = new Map<string, DocumentProcessingJobRecord>();
  private readonly chunks = new Map<string, DocumentChunkRecord[]>();
  private readonly chatConversations = new Map<string, KnowledgeChatConversationRecord>();
  private readonly chatMessages = new Map<string, KnowledgeChatMessageRecord[]>();

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

  async createChatConversation(input: {
    id?: string;
    userId: string;
    title: string;
    activeModelProfileId: string;
  }): Promise<KnowledgeChatConversationRecord> {
    const now = new Date().toISOString();
    const conversation: KnowledgeChatConversationRecord = {
      id: input.id ?? `conv_${randomUUID()}`,
      userId: input.userId,
      title: input.title,
      activeModelProfileId: input.activeModelProfileId,
      createdAt: now,
      updatedAt: now
    };
    this.chatConversations.set(conversation.id, cloneChatConversation(conversation));
    return cloneChatConversation(conversation);
  }

  async listChatConversationsForUser(
    userId: string
  ): Promise<{ items: KnowledgeChatConversationRecord[]; total: number }> {
    const items = [...this.chatConversations.values()]
      .filter(conversation => conversation.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneChatConversation);

    return { items, total: items.length };
  }

  async appendChatMessage(input: CreateKnowledgeChatMessageRecordInput): Promise<KnowledgeChatMessageRecord> {
    const messageInput = CreateKnowledgeChatMessageRecordInputSchema.parse(input);
    const conversation = this.chatConversations.get(messageInput.conversationId);
    if (!conversation || conversation.userId !== messageInput.userId) {
      throw new Error('knowledge_chat_conversation_not_found');
    }

    const now = new Date().toISOString();
    const message: KnowledgeChatMessageRecord = {
      id: `msg_${randomUUID()}`,
      conversationId: messageInput.conversationId,
      userId: messageInput.userId,
      role: messageInput.role,
      content: messageInput.content,
      modelProfileId: messageInput.modelProfileId,
      traceId: messageInput.traceId,
      citations: messageInput.citations ?? [],
      route: messageInput.route,
      diagnostics: messageInput.diagnostics,
      feedback: messageInput.feedback,
      createdAt: now
    };
    const messages = this.chatMessages.get(messageInput.conversationId) ?? [];
    messages.push(cloneChatMessage(message));
    this.chatMessages.set(messageInput.conversationId, messages);
    this.chatConversations.set(messageInput.conversationId, { ...conversation, updatedAt: now });

    return cloneChatMessage(message);
  }

  async listChatMessages(
    conversationId: string,
    userId: string
  ): Promise<{ items: KnowledgeChatMessageRecord[]; total: number }> {
    const conversation = this.chatConversations.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return { items: [], total: 0 };
    }

    const items = (this.chatMessages.get(conversationId) ?? [])
      .filter(message => message.userId === userId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(cloneChatMessage);

    return { items, total: items.length };
  }

  async updateMessageFeedback(messageId: string, feedback: unknown): Promise<KnowledgeChatMessageRecord | undefined> {
    for (const [conversationId, messages] of this.chatMessages.entries()) {
      const index = messages.findIndex(message => message.id === messageId);
      if (index !== -1) {
        const updated = { ...messages[index], feedback: feedback as KnowledgeChatMessageRecord['feedback'] };
        messages[index] = updated;
        const conversation = this.chatConversations.get(conversationId);
        if (conversation) {
          this.chatConversations.set(conversationId, { ...conversation, updatedAt: new Date().toISOString() });
        }
        return cloneChatMessage(updated);
      }
    }
    return undefined;
  }
}

function cloneDocument(document: KnowledgeDocumentRecord): KnowledgeDocumentRecord {
  return { ...document, metadata: { ...document.metadata } };
}

function cloneJob(job: DocumentProcessingJobRecord): DocumentProcessingJobRecord {
  return {
    ...job,
    stages: job.stages.map(stage => ({ ...stage })),
    progress: { ...job.progress },
    error: job.error ? { ...job.error } : undefined
  };
}

function cloneChunk(chunk: DocumentChunkRecord): DocumentChunkRecord {
  return { ...chunk };
}

function cloneChatConversation(conversation: KnowledgeChatConversationRecord): KnowledgeChatConversationRecord {
  return { ...conversation };
}

function cloneChatMessage(message: KnowledgeChatMessageRecord): KnowledgeChatMessageRecord {
  return {
    ...message,
    citations: message.citations.map(citation => ({ ...citation })),
    route: cloneJson(message.route),
    diagnostics: cloneJson(message.diagnostics),
    feedback: message.feedback ? { ...message.feedback } : undefined
  };
}

function cloneJson<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
