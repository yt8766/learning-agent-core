import { createHash } from 'node:crypto';

import { sendLarkDigestMessage } from './briefing-lark';
import { appendDailyTechBriefingRun, saveBriefingHistory } from './briefing-storage';
import { finalizeCategoryStatus, updateHistoryRecords } from './briefing-category-processor';
import type {
  BriefingHistoryRecord,
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingDigestResult,
  TechBriefingRunRecord
} from './briefing.types';

export async function deliverBriefingDigest(params: {
  workspaceRoot: string;
  categories: TechBriefingCategory[];
  categoryResults: TechBriefingCategoryResult[];
  digest: TechBriefingDigestResult;
  history: BriefingHistoryRecord[];
  now: Date;
  duplicateWindowDays: number;
  larkDigestMode: 'markdown-summary' | 'interactive-card' | 'dual';
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ sent: boolean; finalizedCategories: TechBriefingCategoryResult[]; run: TechBriefingRunRecord }> {
  const sent = await sendBriefingDigest({
    digest: params.digest,
    larkDigestMode: params.larkDigestMode,
    webhookUrl: params.webhookUrl,
    fetchImpl: params.fetchImpl
  });

  if (sent) {
    await saveBriefingHistory(
      params.workspaceRoot,
      updateHistoryRecords(params.history, params.categoryResults, params.now),
      params.now,
      params.duplicateWindowDays
    );
  }

  const finalizedCategories = params.categoryResults.map(category => finalizeCategoryStatus(category, sent));
  const run = buildTechBriefingRun({
    now: params.now,
    categories: params.categories,
    finalizedCategories,
    digest: params.digest
  });
  await appendDailyTechBriefingRun(params.workspaceRoot, run);
  return { sent, finalizedCategories, run };
}

export async function sendBriefingDigest(params: {
  digest: TechBriefingDigestResult;
  larkDigestMode: 'markdown-summary' | 'interactive-card' | 'dual';
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  if (!params.digest.categoryCount) {
    return false;
  }
  const response = await sendLarkDigestMessage({
    title: params.digest.title,
    content: params.digest.content,
    card: params.digest.card,
    renderMode: params.larkDigestMode,
    webhookUrl: params.webhookUrl,
    fetchImpl: params.fetchImpl
  });
  return !('skipped' in response);
}

export function buildTechBriefingRun(params: {
  now: Date;
  categories: TechBriefingCategory[];
  finalizedCategories: TechBriefingCategoryResult[];
  digest: TechBriefingDigestResult;
}): TechBriefingRunRecord {
  return {
    id: createHash('sha1')
      .update(
        `${params.now.toISOString()}:${params.categories.join('|')}:${params.finalizedCategories.map(item => item.status).join('|')}`
      )
      .digest('hex')
      .slice(0, 12),
    runAt: params.now.toISOString(),
    status: params.finalizedCategories.every(
      item => item.status === 'sent' || item.status === 'empty' || item.status === 'skipped'
    )
      ? 'sent'
      : params.finalizedCategories.some(item => item.status === 'sent' || item.status === 'empty')
        ? 'partial'
        : 'failed',
    categories: params.finalizedCategories,
    digest: {
      title: params.digest.title,
      mode: params.categories.length === 7 ? 'single-summary-card' : 'per-category',
      categoryCount: params.digest.categoryCount,
      newCount: params.digest.newCount,
      updateCount: params.digest.updateCount,
      crossRunSuppressedCount: params.digest.crossRunSuppressedCount,
      sameRunMergedCount: params.digest.sameRunMergedCount,
      overflowCollapsedCount: params.digest.overflowCollapsedCount
    }
  };
}
