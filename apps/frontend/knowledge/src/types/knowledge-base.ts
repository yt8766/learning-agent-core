import type { KnowledgeBase as CoreKnowledgeBase } from '@agent/knowledge/browser';
import type { KnowledgeBaseHealth } from '@agent/knowledge/browser';
import type { ID, ISODateTime } from './common';

export type KnowledgeBaseStatus = 'active' | 'disabled' | 'archived';
export type KnowledgeBaseVisibility = 'private' | 'workspace' | 'public';

export interface KnowledgeBase extends CoreKnowledgeBase {
  id: ID;
  workspaceId: ID;
  name: string;
  description?: string;
  icon?: string;
  tags: string[];
  visibility: KnowledgeBaseVisibility;
  status: KnowledgeBaseStatus;
  documentCount: number;
  chunkCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  latestEvalScore?: number;
  latestQuestionCount?: number;
  latestTraceAt?: ISODateTime;
  defaultRetrievalConfigId?: ID;
  defaultPromptTemplateId?: ID;
  health?: Partial<KnowledgeBaseHealth>;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  tags?: string[];
  visibility: KnowledgeBaseVisibility;
}

export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: KnowledgeBaseVisibility;
  status?: KnowledgeBaseStatus;
  defaultRetrievalConfigId?: ID;
  defaultPromptTemplateId?: ID;
}
