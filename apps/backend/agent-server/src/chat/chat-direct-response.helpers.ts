import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  DATA_REPORT_GENERATION_NODE_META,
  DATA_REPORT_PREVIEW_STAGE_META,
  DATA_REPORT_SANDPACK_GENERATE_HEARTBEAT_MS,
  DATA_REPORT_SANDPACK_STAGE_META,
  executeDataReportSandpackGraph,
  generateDataReportPreview,
  type DataReportFileGenerationEvent,
  type DataReportGenerationNode,
  type DataReportNodeStageEvent,
  type DataReportPreviewStage,
  type DataReportPreviewStageEvent,
  type DataReportSandpackFiles,
  type DataReportSandpackStage
} from '../runtime/core/runtime-data-report-facade';
import { withLlmRetry } from '@agent/runtime';

import type { RuntimeHost } from '../runtime/core/runtime.host';
import type { DirectChatRequestDto, DirectChatSseEvent } from './chat.direct.dto';

type SandpackFiles = Record<string, { code: string }>;
type SandpackStringFiles = DataReportSandpackFiles;
type ResolveWorkflowPresetFn = Parameters<typeof generateDataReportPreview>[0]['resolveWorkflowPreset'];

export function normalizeDirectMessages(dto: DirectChatRequestDto) {
  const normalizedMessages = Array.isArray(dto.messages)
    ? dto.messages
        .filter(message => Boolean(message?.content?.trim()))
        .map(message => ({
          role: message.role,
          content: message.content.trim()
        }))
    : [];

  if (normalizedMessages.length === 0 && dto.message?.trim()) {
    normalizedMessages.push({
      role: 'user',
      content: dto.message.trim()
    });
  }

  if (normalizedMessages.length === 0) {
    throw new BadRequestException('message or messages is required.');
  }

  if (dto.systemPrompt?.trim()) {
    normalizedMessages.unshift({
      role: 'system',
      content: dto.systemPrompt.trim()
    });
  }

  return normalizedMessages;
}

export function extractDirectGoal(dto: DirectChatRequestDto) {
  return normalizeDirectMessages(dto)
    .filter(message => message.role !== 'system')
    .map(message => message.content)
    .join('\n')
    .trim();
}

export async function generateSandpackPreview(
  dto: DirectChatRequestDto,
  resolveWorkflowPreset: ResolveWorkflowPresetFn
): Promise<SandpackFiles> {
  return streamSandpackPreview(dto, () => undefined, resolveWorkflowPreset);
}

export async function streamSandpackPreview(
  dto: DirectChatRequestDto,
  onEvent: (event: DirectChatSseEvent) => void,
  resolveWorkflowPreset: ResolveWorkflowPresetFn
): Promise<SandpackFiles> {
  const preview = generateDataReportPreview({
    goal: extractDirectGoal(dto),
    taskContext: dto.projectId,
    resolveWorkflowPreset,
    onStage: event => handlePreviewStageEvent(onEvent, event)
  });

  const stringFiles = toSandpackStringFiles(preview.sandpackFiles);
  onEvent({
    type: 'files',
    data: {
      files: stringFiles
    }
  });

  return preview.sandpackFiles;
}

export async function streamChat(
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto,
  onEvent: (event: DirectChatSseEvent) => void
): Promise<{ content: string }> {
  const llm = runtimeHost.llmProvider;
  if (!llm?.isConfigured()) {
    throw new ServiceUnavailableException('LLM provider is not configured.');
  }

  const messages = normalizeDirectMessages(dto);
  const content = await withLlmRetry(
    currentMessages =>
      llm.streamText(
        currentMessages,
        {
          role: 'manager',
          modelId: dto.modelId,
          temperature: typeof dto.temperature === 'number' ? dto.temperature : 0.2,
          maxTokens: typeof dto.maxTokens === 'number' ? dto.maxTokens : undefined
        },
        token => {
          onEvent({
            type: 'token',
            data: { content: token }
          });
        }
      ),
    messages
  );

  return { content: String(content) };
}

export async function streamSandpackCode(
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto,
  onEvent: (event: DirectChatSseEvent) => void
): Promise<{ files: SandpackStringFiles; content: string }> {
  const llm = runtimeHost.llmProvider;
  if (!llm?.isConfigured()) {
    throw new ServiceUnavailableException('LLM provider is not configured.');
  }

  pushSandpackStage(onEvent, 'generate');
  const heartbeat = setInterval(() => {
    onEvent({
      type: 'stage',
      data: {
        stage: 'generate',
        label: '正在生成 Sandpack 代码，请稍候...',
        progressPercent: 60,
        status: 'pending'
      }
    });
  }, DATA_REPORT_SANDPACK_GENERATE_HEARTBEAT_MS);

  const nodeStartedAt = new Map<string, number>();
  const fileStartedAt = new Map<string, number>();

  try {
    const graphResult = await executeDataReportSandpackGraph({
      llm,
      goal: extractDirectGoal(dto),
      systemPrompt: dto.systemPrompt,
      modelId: dto.modelId,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      mockConfig: dto.mockConfig,
      onStage: event => pushDataReportGenerationNode(onEvent, event, nodeStartedAt),
      onFileStage: event => pushDataReportFileStage(onEvent, event, fileStartedAt),
      onRetry: attempt => {
        onEvent({
          type: 'stage',
          data: {
            stage: 'generate',
            label: `第 ${attempt + 1} 次尝试修正 Sandpack JSON 输出`,
            progressPercent: 60,
            status: 'pending'
          }
        });
      }
    });

    if (!graphResult.rawContent || !graphResult.payload) {
      throw new Error('Data report sandpack graph finished without generated files.');
    }

    clearInterval(heartbeat);
    pushSandpackStage(onEvent, 'parse');
    const normalizedFiles = graphResult.payload.files;
    onEvent({
      type: 'files',
      data: {
        files: normalizedFiles
      }
    });

    return {
      files: normalizedFiles,
      content: JSON.stringify(
        {
          ...graphResult.payload,
          files: normalizedFiles
        },
        null,
        2
      )
    };
  } finally {
    clearInterval(heartbeat);
  }
}

function pushPreviewStage(
  onEvent: (event: DirectChatSseEvent) => void,
  stage: DataReportPreviewStage,
  status: 'pending' | 'success' | 'error' = 'pending',
  labelOverride?: string
) {
  const meta = DATA_REPORT_PREVIEW_STAGE_META.find(item => item.stage === stage);
  if (!meta) {
    return;
  }

  onEvent({
    type: 'stage',
    data: {
      stage: meta.stage,
      label: labelOverride ?? meta.label,
      progressPercent: meta.progressPercent,
      status
    }
  });
}

function handlePreviewStageEvent(onEvent: (event: DirectChatSseEvent) => void, event: DataReportPreviewStageEvent) {
  const details = event.details ?? {};
  const appliedFixes =
    typeof details.appliedFixes === 'number' && details.appliedFixes > 0
      ? `执行 AST 修复与兜底，修复 ${details.appliedFixes} 处问题`
      : undefined;

  pushPreviewStage(onEvent, event.stage, event.status, event.stage === 'postprocess' ? appliedFixes : undefined);
}

function pushSandpackStage(onEvent: (event: DirectChatSseEvent) => void, stage: DataReportSandpackStage) {
  const meta = DATA_REPORT_SANDPACK_STAGE_META.find(item => item.stage === stage);
  if (!meta) {
    return;
  }

  onEvent({
    type: 'stage',
    data: {
      stage: meta.stage,
      label: meta.label,
      progressPercent: meta.progressPercent,
      status: meta.progressPercent >= 100 ? 'success' : 'pending'
    }
  });
}

function pushDataReportGenerationNode(
  onEvent: (event: DirectChatSseEvent) => void,
  event: DataReportNodeStageEvent,
  nodeStartedAt: Map<string, number>
) {
  const meta = DATA_REPORT_GENERATION_NODE_META.find(item => item.node === event.node);
  if (!meta) {
    return;
  }

  const now = Date.now();
  if (event.status === 'pending') {
    nodeStartedAt.set(event.node, now);
  }
  const startedAtMs = nodeStartedAt.get(event.node) ?? now;
  const durationMs = event.status === 'pending' ? 0 : Math.max(0, now - startedAtMs);

  onEvent({
    type: 'stage',
    data: {
      stage: event.node,
      label: meta.label,
      progressPercent: meta.progressPercent,
      status: event.status,
      groupLabel: meta.groupLabel,
      stepLabel: meta.stepLabel,
      parallelMode: meta.parallelMode,
      startedAtMs,
      timestampMs: now,
      durationMs,
      detailSummary: formatDataReportNodeDetailSummary(event)
    }
  });
}

function formatDataReportNodeDetailSummary(event: DataReportNodeStageEvent) {
  const meta = DATA_REPORT_GENERATION_NODE_META.find(item => item.node === event.node);
  const details = (event as DataReportNodeStageEvent & { details?: Record<string, unknown> }).details;

  const contextPrefix = [meta?.groupLabel, meta?.parallelMode ? `mode=${meta.parallelMode}` : undefined]
    .filter(Boolean)
    .join(' · ');

  if (!details) {
    return contextPrefix || undefined;
  }

  if (event.node === 'scopeNode') {
    const summary =
      details.referenceMode && details.routeName
        ? `scope=${details.referenceMode} · route=${details.routeName}`
        : undefined;
    return [contextPrefix, summary].filter(Boolean).join(' · ') || undefined;
  }

  if (event.node === 'componentNode') {
    const summary = details.singleReportMode
      ? `single=${details.singleReportMode} · planned=${details.plannedCount ?? 0}`
      : undefined;
    return [contextPrefix, summary].filter(Boolean).join(' · ') || undefined;
  }

  if (event.node === 'appGenNode') {
    const summary = [
      details.appSource ? `source=${details.appSource}` : undefined,
      details.appStrategy ? `appStrategy=${details.appStrategy}` : undefined,
      details.referenceMode ? `referenceMode=${details.referenceMode}` : undefined,
      details.templateId ? `templateId=${details.templateId}` : undefined
    ]
      .filter(Boolean)
      .join(' · ');
    return [contextPrefix, summary].filter(Boolean).join(' · ') || undefined;
  }

  if (event.node === 'assembleNode') {
    const summary = typeof details.fileCount === 'number' ? `files=${details.fileCount}` : undefined;
    return [contextPrefix, summary].filter(Boolean).join(' · ') || undefined;
  }

  return contextPrefix || undefined;
}

function pushDataReportFileStage(
  onEvent: (event: DirectChatSseEvent) => void,
  event: DataReportFileGenerationEvent,
  fileStartedAt: Map<string, number>
) {
  const trackingKey = `${event.phase}:${event.path}`;
  const now = Date.now();
  if (event.status === 'pending') {
    fileStartedAt.set(trackingKey, now);
  }
  const startedAtMs = fileStartedAt.get(trackingKey) ?? now;
  const durationMs = event.status === 'pending' ? 0 : Math.max(0, now - startedAtMs);

  onEvent({
    type: 'stage',
    data: {
      stage: 'generate_file',
      label:
        event.status === 'pending'
          ? `生成阶段 · 正在生成${event.phase === 'leaf' ? '叶子' : '聚合'}文件`
          : `生成阶段 · 已生成${event.phase === 'leaf' ? '叶子' : '聚合'}文件`,
      progressPercent:
        event.phase === 'leaf' ? (event.status === 'pending' ? 62 : 72) : event.status === 'pending' ? 82 : 90,
      status: event.status,
      groupLabel: event.phase === 'leaf' ? '生成阶段' : '组装阶段',
      stepLabel: event.phase === 'leaf' ? '叶子文件生成' : '聚合文件生成',
      filePhase: event.phase,
      filePath: event.path,
      startedAtMs,
      timestampMs: now,
      durationMs
    }
  });
}

function toSandpackStringFiles(files: SandpackFiles): SandpackStringFiles {
  return Object.fromEntries(Object.entries(files).map(([path, value]) => [path, value.code]));
}
