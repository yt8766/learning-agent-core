import type { ZodType } from 'zod/v4';

import type { ChatMessage } from '../providers/llm/base/llm-provider.types';
import { appendJsonSafetyToMessages } from '../prompts';
import { withLlmRetry } from '../retry';

export type StructuredParseStatus = 'success' | 'schema_parse_failed' | 'provider_failed' | 'not_configured';

export interface StructuredContractMeta {
  contractName: string;
  contractVersion: string;
  parseStatus: StructuredParseStatus;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export interface SafeGenerateObjectResult<T> {
  object: T | null;
  meta: StructuredContractMeta;
}

export interface SafeGenerateObjectRetryOptions {
  formatErrorFeedback?: (error: Error) => string;
}

type SafeGenerateObjectInvokeParams<T> =
  | {
      invoke: () => Promise<T>;
      messages?: never;
      invokeWithMessages?: never;
    }
  | {
      invoke?: never;
      messages: ChatMessage[];
      invokeWithMessages: (messages: ChatMessage[]) => Promise<T>;
    };

function classifyParseStatus(error: unknown): StructuredParseStatus {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/zod|schema|json|object|parse|validation|invalid input|expected/i.test(message)) {
    return 'schema_parse_failed';
  }
  return 'provider_failed';
}

export async function safeGenerateObject<T>(
  params: {
    contractName: string;
    contractVersion: string;
    isConfigured: boolean;
    schema?: ZodType<T>;
    retryOptions?: SafeGenerateObjectRetryOptions;
  } & SafeGenerateObjectInvokeParams<T>
): Promise<SafeGenerateObjectResult<T>> {
  if (!params.isConfigured) {
    return {
      object: null,
      meta: {
        contractName: params.contractName,
        contractVersion: params.contractVersion,
        parseStatus: 'not_configured',
        fallbackUsed: true,
        fallbackReason: 'LLM provider is not configured.'
      }
    };
  }

  try {
    let object: T;

    if ('invoke' in params && params.invoke) {
      object = params.schema ? params.schema.parse(await params.invoke()) : await params.invoke();
    } else {
      const safeMessages = appendJsonSafetyToMessages(params.messages);
      object = await withLlmRetry(
        async retryMessages => {
          const result = await params.invokeWithMessages(retryMessages);
          return params.schema ? params.schema.parse(result) : (result as T);
        },
        safeMessages,
        {
          shouldRetry: error => classifyParseStatus(error) === 'schema_parse_failed',
          formatErrorFeedback: params.retryOptions?.formatErrorFeedback
        }
      );
    }

    return {
      object,
      meta: {
        contractName: params.contractName,
        contractVersion: params.contractVersion,
        parseStatus: 'success',
        fallbackUsed: false
      }
    };
  } catch (error) {
    return {
      object: null,
      meta: {
        contractName: params.contractName,
        contractVersion: params.contractVersion,
        parseStatus: classifyParseStatus(error),
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : String(error ?? 'unknown error')
      }
    };
  }
}
