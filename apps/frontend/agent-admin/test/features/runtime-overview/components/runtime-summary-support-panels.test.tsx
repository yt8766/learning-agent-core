import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CompanyAgentsPanel } from '@/features/company-agents/company-agents-panel';
import { ConnectorTemplateForm } from '@/features/connectors-center/connector-template-form';
import { RuntimeSummaryBudget } from '@/features/runtime-overview/components/runtime-summary-budget';
import { RuntimeSummaryChannelDeliveries } from '@/features/runtime-overview/components/runtime-summary-channel-deliveries';
import { RuntimeSummaryGovernance } from '@/features/runtime-overview/components/runtime-summary-governance';

describe('runtime summary support panels', () => {
  it('renders company agents, governance and channel deliveries with populated data', () => {
    const companyAgentsHtml = renderToStaticMarkup(
      <CompanyAgentsPanel
        agents={[
          {
            id: 'repo-reviewer',
            displayName: 'Repo Reviewer',
            ministry: 'xingbu-review',
            defaultModel: 'gpt-5.4',
            owner: 'platform',
            enabled: true,
            governanceStatus: 'ready',
            activeTaskCount: 2,
            totalTaskCount: 18,
            successRate: 0.94,
            promotionState: 'promoted',
            tags: ['review', 'policy'],
            requiredConnectors: ['github-mcp'],
            recentTaskGoals: ['审查最近一次部署', '检查回归风险'],
            sourceRuns: ['run-1'],
            supportedCapabilities: ['review', 'policy-check']
          } as any
        ]}
        onEnableAgent={vi.fn()}
        onDisableAgent={vi.fn()}
      />
    );

    const governanceHtml = renderToStaticMarkup(
      <RuntimeSummaryGovernance
        runtime={
          {
            recentGovernanceAudit: [
              {
                id: 'audit-1',
                action: 'revoke_approval_policy',
                scope: 'task',
                targetId: 'task-1',
                actor: 'admin',
                outcome: 'success',
                at: '2026-04-01T12:00:00.000Z',
                reason: '高危操作需要人工复核'
              }
            ]
          } as any
        }
      />
    );

    const deliveriesHtml = renderToStaticMarkup(
      <RuntimeSummaryChannelDeliveries
        channelDeliveries={[
          {
            id: 'delivery-1',
            channel: 'feishu',
            segment: 'progress',
            channelChatId: 'oc_123',
            taskId: 'task-1',
            sessionId: 'session-1',
            status: 'failed',
            attemptCount: 3,
            queuedAt: '2026-04-01T12:00:00.000Z',
            deliveredAt: '2026-04-01T12:01:00.000Z',
            failureReason: 'webhook timeout'
          }
        ]}
      />
    );

    expect(companyAgentsHtml).toContain('公司专员编排');
    expect(companyAgentsHtml).toContain('Repo Reviewer');
    expect(companyAgentsHtml).toContain('成功率 94%');
    expect(companyAgentsHtml).toContain('github-mcp');
    expect(governanceHtml).toContain('Governance Audit');
    expect(governanceHtml).toContain('revoke_approval_policy');
    expect(governanceHtml).toContain('高危操作需要人工复核');
    expect(deliveriesHtml).toContain('Channel Deliveries');
    expect(deliveriesHtml).toContain('feishu / progress');
    expect(deliveriesHtml).toContain('webhook timeout');
  });

  it('renders budget alerts and connector template branches', () => {
    const budgetHtml = renderToStaticMarkup(
      <RuntimeSummaryBudget
        runtime={
          {
            usageAnalytics: {
              totalEstimatedPromptTokens: 1200,
              totalEstimatedCompletionTokens: 2400,
              totalEstimatedTokens: 3600,
              measuredRunCount: 4,
              estimatedRunCount: 2,
              totalEstimatedCostCny: 32.45,
              totalEstimatedCostUsd: 4.5123,
              providerMeasuredCostCny: 18.12,
              estimatedFallbackCostCny: 12.33,
              budgetPolicy: {
                dailyTokenWarning: 50000,
                dailyCostCnyWarning: 120,
                totalCostCnyWarning: 360
              },
              alerts: [
                {
                  title: 'daily token warning',
                  description: '接近日 token 阈值',
                  level: 'warning'
                },
                {
                  title: 'critical budget',
                  description: '累计费用已经触顶',
                  level: 'critical'
                }
              ]
            }
          } as any
        }
      />
    );

    const stdioFormHtml = renderToStaticMarkup(
      <ConnectorTemplateForm
        templateId="github-mcp-template"
        transport="stdio"
        displayName="GitHub MCP"
        endpoint=""
        command="npx"
        argsText="-y github-mcp-server"
        apiKey=""
        onTransportChange={vi.fn()}
        onDisplayNameChange={vi.fn()}
        onEndpointChange={vi.fn()}
        onCommandChange={vi.fn()}
        onArgsTextChange={vi.fn()}
        onApiKeyChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const httpFormHtml = renderToStaticMarkup(
      <ConnectorTemplateForm
        templateId="lark-mcp-template"
        transport="http"
        displayName="Lark MCP"
        endpoint="https://mcp.example.com"
        command=""
        argsText=""
        apiKey="secret"
        onTransportChange={vi.fn()}
        onDisplayNameChange={vi.fn()}
        onEndpointChange={vi.fn()}
        onCommandChange={vi.fn()}
        onArgsTextChange={vi.fn()}
        onApiKeyChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(budgetHtml).toContain('Budget Policy &amp; Alerts');
    expect(budgetHtml).toContain('daily token warning');
    expect(budgetHtml).toContain('critical budget');
    expect(budgetHtml).toContain('provider 实测 / fallback 估算');
    expect(stdioFormHtml).toContain('Display Name');
    expect(stdioFormHtml).toContain('Args');
    expect(stdioFormHtml).toContain('保存配置');
    expect(httpFormHtml).toContain('Endpoint');
    expect(httpFormHtml).toContain('API Key / Token');
  });
});
