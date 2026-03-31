import type { ZodType } from 'zod/v4';

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

function classifyParseStatus(error: unknown): StructuredParseStatus {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/zod|schema|json|object|parse|validation|invalid input|expected/i.test(message)) {
    return 'schema_parse_failed';
  }
  return 'provider_failed';
}

export async function safeGenerateObject<T>(params: {
  contractName: string;
  contractVersion: string;
  isConfigured: boolean;
  invoke: () => Promise<T>;
  schema?: ZodType<T>;
}): Promise<SafeGenerateObjectResult<T>> {
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
    const object = await params.invoke();
    return {
      object: params.schema ? params.schema.parse(object) : object,
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
