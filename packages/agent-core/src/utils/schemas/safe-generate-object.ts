import type { ZodType } from 'zod/v4';

import type { ChatMessage } from '../../adapters/llm/llm-provider';
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
    const object =
      'invoke' in params && params.invoke
        ? await params.invoke()
        : await withLlmRetry(
            async retryMessages => {
              const result = await params.invokeWithMessages(retryMessages);
              return params.schema ? params.schema.parse(result) : result;
            },
            params.messages,
            {
              shouldRetry: error => classifyParseStatus(error) === 'schema_parse_failed'
            }
          );
    return {
      object: 'invoke' in params && params.invoke && params.schema ? params.schema.parse(object) : object,
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
