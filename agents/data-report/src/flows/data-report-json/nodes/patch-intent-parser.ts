import type { DataReportJsonPatchIntent } from '../../../types/data-report-json';
import type { DataReportJsonPatchTarget } from './shared-core';

function collectMatches(
  request: string,
  pattern: RegExp,
  target: DataReportJsonPatchTarget,
  action: DataReportJsonPatchIntent['action']
) {
  return Array.from(request.matchAll(pattern)).map(match => ({
    target,
    action,
    subject: match[1]?.trim()
  }));
}

export function parsePatchIntents(request?: string): DataReportJsonPatchIntent[] {
  const normalized = request?.trim() ?? '';
  if (!normalized) {
    return [];
  }

  const intents: DataReportJsonPatchIntent[] = [];
  const titleMatchers: Array<{ pattern: RegExp; target: DataReportJsonPatchTarget }> = [
    {
      pattern: /(?:明细表|表格|table)(?:.{0,8})?(?:标题改成|标题改为|改成|改为)([^，。\n]+)/gi,
      target: 'tableBlock'
    },
    {
      pattern: /(?:图表|趋势图|chart)(?:.{0,8})?(?:标题改成|标题改为|改成|改为)([^，。\n]+)/gi,
      target: 'chartBlock'
    },
    {
      pattern: /(?:指标卡|指标|metrics?)(?:.{0,8})?(?:标题改成|标题改为|改成|改为)([^，。\n]+)/gi,
      target: 'metricsBlock'
    }
  ];

  intents.push(
    ...collectMatches(normalized, /(?:新增|增加|添加)指标\s*([^，。\n]+)/g, 'metricsBlock', 'add'),
    ...collectMatches(normalized, /(?:删除|移除|去掉)指标\s*([^，。\n]+)/g, 'metricsBlock', 'remove'),
    ...collectMatches(
      normalized,
      /(?:(?:新增|增加|添加)(?:(?:图表\s*)?(?:series|序列)\s*|图表\s*)|图表(?:新增|增加|添加)\s*)([^，。\n]+)/gi,
      'chartBlock',
      'add'
    ),
    ...collectMatches(
      normalized,
      /(?:(?:删除|移除|去掉)(?:(?:图表\s*)?(?:series|序列)\s*|图表\s*)|图表(?:删除|移除|去掉)\s*)([^，。\n]+)/gi,
      'chartBlock',
      'remove'
    ),
    ...collectMatches(normalized, /(?:新增|增加|添加)([^，。\n]+?)列/g, 'tableBlock', 'add'),
    ...collectMatches(normalized, /(?:删除|移除|去掉)([^，。\n]+?)列/g, 'tableBlock', 'remove')
  );

  for (const matcher of titleMatchers) {
    intents.push(...collectMatches(normalized, matcher.pattern, matcher.target, 'update-title'));
  }

  if (/(筛选|筛选项|filter)/i.test(normalized)) {
    if (/(输入框|选择框|下拉|单选|多选)/i.test(normalized)) {
      intents.push({ target: 'filterSchema', action: 'update-component' });
    }
    if (/options|选项/.test(normalized) && /(重生成|重新生成|刷新)/.test(normalized)) {
      intents.push({ target: 'filterSchema', action: 'regenerate-options' });
    }
    if (/默认/.test(normalized)) {
      intents.push({ target: 'filterSchema', action: 'update-default' });
    }
  }

  if (/(图表|chart|折线|柱状|饼图|line|bar|pie|组合图|混合图)/i.test(normalized) && /(改|用|走)/.test(normalized)) {
    intents.push({ target: 'chartBlock', action: 'update-style' });
  }

  if (!intents.length) {
    if (/(筛选|筛选项|filter)/i.test(normalized)) {
      intents.push({ target: 'filterSchema', action: 'unknown' });
    } else if (/(图表|chart|折线|柱状|饼图|line|bar|pie)/i.test(normalized)) {
      intents.push({ target: 'chartBlock', action: 'unknown' });
    } else if (/(明细表|表格|table|列)/i.test(normalized)) {
      intents.push({ target: 'tableBlock', action: 'unknown' });
    } else if (/(指标|metric|指标卡)/i.test(normalized)) {
      intents.push({ target: 'metricsBlock', action: 'unknown' });
    }
  }

  return intents;
}
