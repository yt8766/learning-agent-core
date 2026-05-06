import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RuntimeSummaryBriefingAudit } from '@/pages/runtime-overview/components/runtime-summary-briefing-audit';

describe('RuntimeSummaryBriefingAudit', () => {
  it('renders category counters and item-level audit records', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryBriefingAudit
        runtime={
          {
            dailyTechBriefing: {
              categories: [
                {
                  category: 'frontend-security',
                  title: '前端安全情报',
                  status: 'sent',
                  itemCount: 2,
                  emptyDigest: false,
                  newCount: 1,
                  updateCount: 1,
                  crossRunSuppressedCount: 3,
                  sameRunMergedCount: 2,
                  overflowCollapsedCount: 1,
                  suppressedSummary: '本轮共节省 6 条低价值噪音，其中跨轮去重 3、同轮合并 2、超上限折叠 1。',
                  savedAttentionCount: 6,
                  preferredSourceNames: ['Datadog Security Labs'],
                  preferredTopicLabels: ['axios', 'npm'],
                  focusAreas: ['浏览器供应链', '公共 API'],
                  trendHighlights: ['Compromised axios npm package delivers cross-platform RAT 连续 2 轮进入简报'],
                  auditRecords: [
                    {
                      messageKey: 'frontend-security:axios-rat',
                      title: 'Compromised axios npm package delivers cross-platform RAT',
                      category: 'frontend-security',
                      decisionReason: 'send_new',
                      updateStatus: 'new',
                      displaySeverity: 'critical',
                      sourceName: 'Datadog Security Labs',
                      sourceGroup: 'authority',
                      publishedAt: '2026-03-30T00:00:00.000Z',
                      sent: true,
                      crossVerified: false,
                      displayScope: 'axios / npm (高度相关)',
                      url: 'https://securitylabs.datadoghq.com/articles/compromised-axios-rat/',
                      whyItMatters: '会直接影响浏览器供应链与公共 API 的凭证安全。',
                      relevanceLevel: 'immediate',
                      recommendedAction: 'fix-now',
                      impactScenarioTags: ['浏览器供应链', '公共 API'],
                      recommendedNextStep: '先核对 lockfile 与制品仓库是否引入受影响版本。'
                    },
                    {
                      messageKey: 'frontend-security:apifox-js-tamper',
                      title: '关于 Apifox 外部 JS 文件受篡改的风险提示与升级公告',
                      category: 'frontend-security',
                      decisionReason: 'suppress_duplicate',
                      updateStatus: 'metadata_only',
                      displaySeverity: 'high',
                      sourceName: 'Apifox 官方公告',
                      sourceGroup: 'official',
                      publishedAt: '2026-03-31T08:00:00.000Z',
                      sent: false,
                      crossVerified: true,
                      displayScope: 'Apifox (中度相关)',
                      url: 'https://docs.apifox.com/8392582m0'
                    }
                  ]
                }
              ]
            }
          } as any
        }
      />
    );

    expect(html).toContain('Briefing Audit Trail');
    expect(html).toContain('前端安全情报');
    expect(html).toContain('新增 1');
    expect(html).toContain('更新 1');
    expect(html).toContain('抑制 3');
    expect(html).toContain('合并 2');
    expect(html).toContain('折叠 1');
    expect(html).toContain('节省注意力 6');
    expect(html).toContain('偏好来源：Datadog Security Labs');
    expect(html).toContain('偏好主题：axios / npm');
    expect(html).toContain('关注面：浏览器供应链 / 公共 API');
    expect(html).toContain('连续变化：Compromised axios npm package delivers cross-platform RAT 连续 2 轮进入简报');
    expect(html).toContain('Compromised axios npm package delivers cross-platform RAT');
    expect(html).toContain('关于 Apifox 外部 JS 文件受篡改的风险提示与升级公告');
    expect(html).toContain('已发送');
    expect(html).toContain('未发送');
    expect(html).toContain('send_new');
    expect(html).toContain('suppress_duplicate');
    expect(html).toContain('axios / npm (高度相关)');
    expect(html).toContain('Apifox (中度相关)');
    expect(html).toContain('值得看原因：会直接影响浏览器供应链与公共 API 的凭证安全。');
    expect(html).toContain('立即相关');
    expect(html).toContain('立即处理');
    expect(html).toContain('首动作：先核对 lockfile 与制品仓库是否引入受影响版本。');
    expect(html).toContain('影响场景：浏览器供应链 / 公共 API');
  });

  it('renders an empty state when no briefing categories are available', () => {
    const html = renderToStaticMarkup(<RuntimeSummaryBriefingAudit runtime={{} as any} />);

    expect(html).toContain('当前还没有可审计的技术简报记录。');
  });
});
