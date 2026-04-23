import type { ILLMProvider } from '@agent/core';
import type { DataReportJsonStructuredInput } from '../runtime/core/runtime-data-report-facade';

export type DirectChatMessages = Parameters<ILLMProvider['streamText']>[0];
export type DirectStageStatus = 'idle' | 'pending' | 'success' | 'error';

export interface DirectChatRequestDto {
  message?: string;
  messages?: DirectChatMessages;
  systemPrompt?: string;
  modelId?: string;
  preferLlm?: boolean;
  disableCache?: boolean;
  temperature?: number;
  maxTokens?: number;
  projectId?: string;
  mockConfig?: Record<string, unknown>;
  reportSchemaInput?: DataReportJsonStructuredInput;
  responseFormat?: 'text' | 'sandpack' | 'preview' | 'report-schema';
}

export interface DirectChatSseEvent {
  type:
    | 'token'
    | 'stage'
    | 'files'
    | 'schema'
    | 'schema_progress'
    | 'schema_partial'
    | 'schema_ready'
    | 'schema_failed'
    | 'done'
    | 'error';
  data?: Record<string, unknown>;
  message?: string;
}
