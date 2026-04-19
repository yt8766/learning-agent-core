import {
  JSON_SAFETY_PROMPT,
  MODEL_CAPABILITIES,
  createDefaultRuntimeLlmProvider,
  createModelCapabilities,
  modelSupportsCapabilities
} from '../src/index.js';
import * as contractLlmExports from '../src/contracts/llm/index.js';
import * as factoryExports from '../src/factories/runtime/index.js';
import * as promptExports from '../src/prompts/index.js';

const textAndToolCall = createModelCapabilities('text', 'tool-call');
const demoModel = { capabilities: textAndToolCall };

console.log(
  JSON.stringify(
    {
      rootAligned:
        createDefaultRuntimeLlmProvider === factoryExports.createDefaultRuntimeLlmProvider &&
        JSON_SAFETY_PROMPT === promptExports.JSON_SAFETY_PROMPT &&
        MODEL_CAPABILITIES === contractLlmExports.MODEL_CAPABILITIES,
      capabilityMatch: modelSupportsCapabilities(demoModel, createModelCapabilities(MODEL_CAPABILITIES.TEXT)),
      toolCallMatch: modelSupportsCapabilities(demoModel, createModelCapabilities(MODEL_CAPABILITIES.TOOL_CALL)),
      missingThinkingMatch: modelSupportsCapabilities(demoModel, createModelCapabilities(MODEL_CAPABILITIES.THINKING))
    },
    null,
    2
  )
);
