import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { dataReportJsonPatchIntentBundleSchema } from '../schemas/patch-intent-schema';
import {
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPatchPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import { parsePatchIntents } from './patch-intent-parser';
import { emitJsonNodeStage, type DataReportJsonNodePatch } from './shared';

function shouldUseLlmFallback(patchIntents: Array<{ action: string }>) {
  return patchIntents.length === 0 || patchIntents.every(intent => intent.action === 'unknown');
}

export async function runJsonPatchIntentNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.patchIntentNode) {
    return handlers.patchIntentNode(state);
  }

  const modificationRequest = state.modificationRequest?.trim();
  let patchIntents = modificationRequest ? parsePatchIntents(modificationRequest) : [];
  let modelId: string | undefined;

  if (modificationRequest && shouldUseLlmFallback(patchIntents) && state.llm?.isConfigured()) {
    const result = await generateReportJsonPartWithLlm({
      state,
      node: 'patchIntentNode',
      schema: dataReportJsonPatchIntentBundleSchema,
      contractName: 'data-report-json-patch-intents',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'patchIntents',
            outputRules: [
              '当前是已有 schema 的 patch 路由阶段，只生成 intents 数组。',
              '一个自然语言请求里可以拆出多个 intents。',
              'target 仅允许 filterSchema、dataSources、metricsBlock、chartBlock、tableBlock。',
              'action 只描述修改动作，不要直接输出完整 schema。'
            ]
          })
        },
        {
          role: 'user',
          content: createDataReportJsonPatchPartUserPrompt({
            changeRequest: modificationRequest,
            analysis: state.analysis,
            currentFragment: { intents: patchIntents },
            currentSchema: state.currentSchema,
            partName: 'patchIntents'
          })
        }
      ],
      partName: 'patchIntents'
    });
    patchIntents = result.object.intents;
    modelId = result.modelId;
  }

  emitJsonNodeStage(state, {
    node: 'patchIntentNode',
    status: 'success',
    modelId,
    details: {
      source: modelId ? 'llm' : 'local',
      modelId,
      intentCount: patchIntents.length,
      targets: Array.from(new Set(patchIntents.map(intent => intent.target)))
    }
  });

  return { patchIntents };
}
