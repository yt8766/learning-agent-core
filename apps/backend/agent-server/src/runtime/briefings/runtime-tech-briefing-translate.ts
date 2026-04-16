import { z } from 'zod/v4';

import type { ILLMProvider } from '@agent/core';
import type { ProviderSettingsRecord } from '@agent/config';
import { generateObjectWithRetry } from '@agent/runtime';

import type { TechBriefingCategory, TechBriefingItem } from './runtime-tech-briefing.types';

const translatedBriefingSchema = z.object({
  title: z.string(),
  summary: z.string()
});
const TRANSLATION_TIMEOUT_MS = 8_000;

export interface RuntimeTechBriefingTranslateContext {
  settings: {
    zhipuApiKey: string;
    zhipuApiBaseUrl: string;
    zhipuModels: {
      manager: string;
      research: string;
      executor: string;
      reviewer: string;
    };
    providers: ProviderSettingsRecord[];
    dailyTechBriefing: {
      translationEnabled: boolean;
      translationModel: string;
    };
  };
  llmProvider?: ILLMProvider;
  translateText?: (input: {
    category: TechBriefingCategory;
    title: string;
    summary: string;
    sourceName: string;
  }) => Promise<{ title: string; summary: string }>;
}

export async function translateBriefingItems(
  category: TechBriefingCategory,
  items: TechBriefingItem[],
  context: RuntimeTechBriefingTranslateContext
) {
  if (!items.length || !context.settings.dailyTechBriefing.translationEnabled) {
    return items;
  }

  const translator = createTranslator(context);
  if (!translator) {
    return items;
  }

  const translated = await Promise.all(
    items.map(async item => {
      try {
        const next = await withTimeout(
          translator({
            category,
            title: item.title,
            summary: item.summary,
            sourceName: item.sourceName
          }),
          TRANSLATION_TIMEOUT_MS
        );
        return {
          ...item,
          title: normalizeChineseOutput(next.title, item.title),
          summary: normalizeChineseOutput(next.summary, item.summary)
        } satisfies TechBriefingItem;
      } catch {
        return item;
      }
    })
  );

  return translated;
}

function createTranslator(context: RuntimeTechBriefingTranslateContext) {
  if (context.translateText) {
    return context.translateText;
  }

  const provider = context.llmProvider;
  if (!provider?.isConfigured()) {
    return null;
  }

  return async (input: { category: TechBriefingCategory; title: string; summary: string; sourceName: string }) => {
    return generateObjectWithRetry({
      llm: provider,
      contractName: 'daily-tech-briefing-translation',
      contractVersion: '1.0.0',
      messages: [
        {
          role: 'system',
          content: [
            '你是一个技术情报编辑。',
            '请把输入的英文或中英混合技术资讯整理成自然、专业、简洁的中文。',
            '不要编造事实，不要新增原文中不存在的结论。',
            '不要使用“某某在最近一周发布了新的官方技术动态”这类模板句，直接写中文结论。',
            'title 产出 1 行中文标题；summary 产出 2-3 句中文摘要，适合日报推送。',
            '保留术语：Next.js、React Compiler、LangGraph、RSC、Adapter API。',
            '规范翻译：workflow=工作流，reasoning=推理。',
            '禁止误译：next phase 不能翻成 Next。'
          ].join('\n')
        },
        {
          role: 'user',
          content: JSON.stringify(input)
        }
      ],
      schema: translatedBriefingSchema,
      options: {
        role: 'research',
        modelId: context.settings.dailyTechBriefing.translationModel,
        maxTokens: 320,
        temperature: 0.2
      }
    });
  };
}

function normalizeChineseOutput(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`briefing_translation_timeout:${timeoutMs}`));
    }, timeoutMs);
    timeout.unref?.();

    promise.then(
      value => {
        clearTimeout(timeout);
        resolve(value);
      },
      error => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
