import type { ILLMProvider } from '@agent/core';

export function deriveRequestedHints(input: string) {
  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  const requestedConnectorTemplate = /github.*(mcp|connector)/i.test(raw)
    ? ('github-mcp-template' as const)
    : /browser.*(mcp|connector)/i.test(raw)
      ? ('browser-mcp-template' as const)
      : /lark.*(mcp|connector)/i.test(raw)
        ? ('lark-mcp-template' as const)
        : undefined;

  const requestedSpecialist = /技术架构|architecture/i.test(raw)
    ? 'technical-architecture'
    : /风控|合规|compliance/i.test(raw)
      ? 'risk-compliance'
      : /支付|payment/i.test(raw)
        ? 'payment-channel'
        : /产品策略|product/i.test(raw)
          ? 'product-strategy'
          : undefined;

  const requestedSkillMatch = raw.match(/(?:skill|技能)\s*[:：]?\s*([a-zA-Z0-9._-]+)/i);
  const imperialDirect = /^\/exec\b/i.test(raw) || /直接执行|立即执行/.test(raw);
  const preferredMode = /研究后|research/i.test(raw)
    ? ('research-first' as const)
    : /workflow|完整流程|走流程/i.test(raw)
      ? ('workflow' as const)
      : /direct-reply|直接回答/i.test(raw)
        ? ('direct-reply' as const)
        : undefined;

  if (
    !requestedConnectorTemplate &&
    !requestedSpecialist &&
    !requestedSkillMatch &&
    !preferredMode &&
    !imperialDirect
  ) {
    return undefined;
  }

  return {
    requestedSpecialist,
    requestedSkill: requestedSkillMatch?.[1],
    requestedConnectorTemplate,
    requestedCapability: requestedConnectorTemplate ?? requestedSkillMatch?.[1],
    preferredMode,
    requestedMode: imperialDirect
      ? ('imperial_direct' as const)
      : /^\/plan[-\w]*/i.test(raw)
        ? ('plan' as const)
        : undefined,
    counselorSelector: {
      strategy: requestedSpecialist ? ('manual' as const) : ('task-type' as const),
      key: requestedSpecialist ?? requestedSkillMatch?.[1],
      candidateIds: requestedSpecialist ? [requestedSpecialist] : undefined
    },
    imperialDirectIntent: imperialDirect
      ? {
          enabled: true,
          trigger: /^\/exec\b/i.test(raw)
            ? ('slash-exec' as const)
            : requestedSkillMatch?.[1]
              ? ('known-capability' as const)
              : ('explicit-direct-execution' as const),
          requestedCapability: requestedConnectorTemplate ?? requestedSkillMatch?.[1],
          reason: '用户明确要求跳过票拟，直接进入执行。'
        }
      : undefined
  };
}

export function shouldDeriveSessionTitle(title?: string) {
  const normalized = title?.trim();
  return !normalized || normalized === '新会话';
}

export function deriveSessionTitle(message: string) {
  const normalized = message
    .trim()
    .replace(/^\/(?:browse|review|qa|ship|plan-ceo-review|plan-eng-review)\b\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalized.slice(0, 48);
}

export async function generateSessionTitleFromSummary(
  llmProvider: Pick<ILLMProvider, 'generateText' | 'isConfigured'> | undefined,
  message: string
): Promise<string> {
  const fallbackTitle = deriveSessionTitle(message);
  const normalized = message.trim();
  if (!normalized || !llmProvider?.isConfigured?.()) {
    return fallbackTitle;
  }

  try {
    const title = await llmProvider.generateText(
      [
        {
          role: 'system',
          content:
            '你要根据用户第一条消息生成一个会话标题。标题必须是摘要，不要照抄原文；使用中文；不要加引号、句号或解释；最多 18 个汉字或 8 个英文单词。'
        },
        {
          role: 'user',
          content: `用户消息：${normalized}`
        }
      ],
      {
        role: 'manager',
        temperature: 0.1,
        maxTokens: 24
      }
    );
    return sanitizeGeneratedSessionTitle(title) || fallbackTitle;
  } catch {
    return fallbackTitle;
  }
}

function sanitizeGeneratedSessionTitle(title: string) {
  return title
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`。.!！]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}
