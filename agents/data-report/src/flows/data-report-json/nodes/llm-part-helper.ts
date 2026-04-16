import { z, type ZodType } from 'zod/v4';

import type { DataReportJsonGenerationNode, DataReportJsonGraphState } from '../../../types/data-report-json';
import type { ChatMessage } from '@agent/adapters';
import { generateObjectWithRetry } from '../../../utils/llm-retry';
import { resolveDataReportJsonNodeModelCandidates } from '../model-policy';

const REPORT_PART_DEFAULTS: Partial<
  Record<
    DataReportJsonGenerationNode,
    {
      maxTokens: number;
    }
  >
> = {
  schemaSpecNode: { maxTokens: 3_600 },
  filterSchemaNode: { maxTokens: 900 },
  dataSourceNode: { maxTokens: 700 },
  patchIntentNode: { maxTokens: 700 },
  metricsBlockNode: { maxTokens: 700 },
  chartBlockNode: { maxTokens: 900 },
  tableBlockNode: { maxTokens: 900 },
  sectionSchemaNode: { maxTokens: 1_600 },
  patchSchemaNode: { maxTokens: 900 }
};

function formatPartRetryFeedback(partName: string, error: Error) {
  return [
    `上一次 ${partName} 输出未通过校验，请只返回当前片段对应的合法 JSON。`,
    `错误信息：${error.message}`,
    '严格要求：',
    '1. 响应第一字符必须是 { 或 [，最后一个字符必须是 } 或 ]',
    '2. 不要输出解释、分析、markdown、代码块、前后缀文本',
    '3. 只返回当前片段需要的字段，不要越界生成其他顶层结构',
    '4. 生成结果必须适配 gosh_admin 前端渲染协议'
  ].join('\n');
}

function formatSchemaTopLevelSummary(schema: ZodType<unknown>) {
  const jsonSchema = z.toJSONSchema(schema);

  if (jsonSchema.type === 'object' && jsonSchema.properties) {
    const keys = Object.keys(jsonSchema.properties);
    return keys.length ? `顶层字段：${keys.join(', ')}` : '';
  }

  if (
    jsonSchema.type === 'array' &&
    jsonSchema.items &&
    typeof jsonSchema.items === 'object' &&
    'type' in jsonSchema.items &&
    jsonSchema.items.type === 'object' &&
    'properties' in jsonSchema.items &&
    jsonSchema.items.properties
  ) {
    const keys = Object.keys(jsonSchema.items.properties);
    return keys.length ? `数组元素字段：${keys.join(', ')}` : '';
  }

  return '';
}

function buildPartSchemaContract(partName: string, schema: ZodType<unknown>) {
  const jsonSchema = z.toJSONSchema(schema);
  const rootType = jsonSchema.type === 'array' ? 'JSON 数组' : 'JSON 对象';
  const topLevelSummary = formatSchemaTopLevelSummary(schema);

  return [
    '【当前片段 Schema 契约】',
    `片段名：${partName}`,
    `根类型：${rootType}`,
    topLevelSummary,
    '必须完整满足以下 JSON Schema：',
    JSON.stringify(jsonSchema)
  ]
    .filter(Boolean)
    .join('\n');
}

function appendPartSchemaContract(messages: ChatMessage[], partName: string, schema: ZodType<unknown>) {
  const contract = buildPartSchemaContract(partName, schema);
  let patched = false;

  const nextMessages = messages.map(message => {
    if (!patched && message.role === 'system') {
      patched = true;
      return {
        ...message,
        content: `${message.content.trim()}\n\n${contract}`
      };
    }

    return message;
  });

  if (patched) {
    return nextMessages;
  }

  return [
    {
      role: 'system' as const,
      content: contract
    },
    ...messages
  ];
}

export async function generateReportJsonPartWithLlm<T>(params: {
  state: DataReportJsonGraphState;
  node: DataReportJsonGenerationNode;
  schema: ZodType<T>;
  contractName: string;
  messages: ChatMessage[];
  partName: string;
}) {
  if (!params.state.llm?.isConfigured()) {
    throw new Error('LLM provider is not configured for brand-new report-schema generation.');
  }

  const defaults = REPORT_PART_DEFAULTS[params.node] ?? { maxTokens: 800 };
  const modelCandidates = resolveDataReportJsonNodeModelCandidates(
    params.state,
    params.node as Exclude<DataReportJsonGenerationNode, 'validateNode'>
  );
  const fallbackReasons: string[] = [];
  const structuredMessages = appendPartSchemaContract(params.messages, params.partName, params.schema);

  for (const modelId of modelCandidates) {
    try {
      const object = await generateObjectWithRetry({
        llm: params.state.llm,
        contractName: params.contractName,
        contractVersion: '1.0.0',
        schema: params.schema,
        retryOptions: {
          formatErrorFeedback: error =>
            [formatPartRetryFeedback(params.partName, error), buildPartSchemaContract(params.partName, params.schema)]
              .filter(Boolean)
              .join('\n\n')
        },
        messages: structuredMessages,
        options: {
          role: 'manager',
          modelId,
          temperature: typeof params.state.temperature === 'number' ? params.state.temperature : 0,
          maxTokens:
            typeof params.state.maxTokens === 'number'
              ? Math.min(params.state.maxTokens, defaults.maxTokens)
              : defaults.maxTokens
        }
      });

      return {
        object,
        modelId
      };
    } catch (error) {
      fallbackReasons.push(
        `[model=${modelId}] ${error instanceof Error ? error.message : String(error ?? 'unknown error')}`
      );
    }
  }

  throw new Error(
    fallbackReasons.join(' | ') || `${params.contractName} generation failed for brand-new report-schema request.`
  );
}
