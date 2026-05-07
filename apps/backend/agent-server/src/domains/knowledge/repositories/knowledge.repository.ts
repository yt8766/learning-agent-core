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
  KnowledgeChatMessageFeedback,
  KnowledgeChatMessageRecord,
  KnowledgeDocumentRecord
} from '../domain/knowledge-document.types';
import type { KnowledgeUploadRecord } from '../domain/knowledge-upload.types';

export interface PageResult<T> {
  items: T[];
  total: number;
}

export interface KnowledgePrincipalSelector {
  userId: string;
}

export type KnowledgeBaseCreateInput = KnowledgeBaseCreateRequest & {
  id?: string;
  ownerId?: string;
  createdByUserId?: string;
};

export interface KnowledgeRepository {
  createBase(input: KnowledgeBaseCreateInput): Promise<KnowledgeBase>;
  listBases(input: KnowledgePrincipalSelector): Promise<KnowledgeBase[]>;
  listBasesForUser(userId: string): Promise<KnowledgeBase[]>;
  findBase(baseId: string): Promise<KnowledgeBase | undefined>;
  addMember(input: KnowledgeBaseMemberCreateRequest & { knowledgeBaseId: string }): Promise<KnowledgeBaseMember>;
  findMember(baseId: string, userId: string): Promise<KnowledgeBaseMember | undefined>;
  listMembers(baseId: string): Promise<KnowledgeBaseMember[]>;
  saveUpload(input: KnowledgeUploadRecord): Promise<KnowledgeUploadRecord>;
  findUpload(uploadId: string): Promise<KnowledgeUploadRecord | undefined>;
  createDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord>;
  updateDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord>;
  findDocument(documentId: string): Promise<KnowledgeDocumentRecord | undefined>;
  deleteDocument(documentId: string): Promise<void>;
  listDocumentsForBase(baseId: string): Promise<KnowledgeDocumentRecord[]>;
  createJob(input: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord>;
  updateJob(input: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord>;
  findLatestJobForDocument(documentId: string): Promise<DocumentProcessingJobRecord | undefined>;
  saveChunks(documentId: string, chunks: DocumentChunkRecord[]): Promise<DocumentChunkRecord[]>;
  listChunks(documentId: string): Promise<DocumentChunkRecord[]>;
  createChatConversation(input: {
    id?: string;
    userId: string;
    title: string;
    activeModelProfileId: string;
  }): Promise<KnowledgeChatConversationRecord>;
  listChatConversationsForUser(userId: string): Promise<PageResult<KnowledgeChatConversationRecord>>;
  appendChatMessage(input: CreateKnowledgeChatMessageRecordInput): Promise<KnowledgeChatMessageRecord>;
  listChatMessages(conversationId: string, userId: string): Promise<PageResult<KnowledgeChatMessageRecord>>;
  updateMessageFeedback(
    messageId: string,
    feedback: KnowledgeChatMessageFeedback
  ): Promise<KnowledgeChatMessageRecord | undefined>;
}
