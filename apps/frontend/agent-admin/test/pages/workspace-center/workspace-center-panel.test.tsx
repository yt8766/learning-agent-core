import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buttonCalls = vi.hoisted(() => ({
  buttons: [] as Array<{ children?: unknown; disabled?: boolean; onClick?: () => void }>
}));

function getButtonText(children: unknown): string {
  if (Array.isArray(children)) {
    return children.map(getButtonText).join('');
  }
  if (children === null || children === undefined || typeof children === 'boolean') {
    return '';
  }
  if (typeof children === 'object' && 'props' in children) {
    return getButtonText((children as { props?: { children?: unknown } }).props?.children);
  }
  return String(children);
}

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick }: { children?: unknown; disabled?: boolean; onClick?: () => void }) => {
    buttonCalls.buttons.push({ children, disabled, onClick });
    return <button disabled={disabled}>{children as any}</button>;
  }
}));

import { WorkspaceCenterPanel } from '@/pages/workspace-center/workspace-center-panel';
import type { WorkspaceCenterRecord } from '@/pages/workspace-center/workspace-center-types';

const workspaceCenter: WorkspaceCenterRecord = {
  workspace: {
    id: 'workspace-1',
    profileId: 'profile-1',
    name: 'Agent Workspace MVP',
    scope: 'company',
    status: 'active',
    owner: {
      id: 'human-1',
      label: 'Platform Lead',
      kind: 'human'
    },
    policyRefs: ['approval-policy'],
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T01:00:00.000Z',
    summary: {
      workspaceId: 'workspace-1',
      scope: 'company',
      activeDraftCount: 2,
      approvedDraftCount: 5,
      reuseRecordCount: 8,
      updatedAt: '2026-04-26T01:00:00.000Z'
    }
  },
  drafts: [
    {
      id: 'draft-1',
      workspaceId: 'workspace-1',
      title: 'Reuse browser evidence',
      description: 'Turn repeated evidence browsing into a reusable skill.',
      triggerHints: ['browser evidence'],
      bodyMarkdown: '# Skill',
      requiredTools: ['browser.open'],
      requiredConnectors: ['browser-mcp'],
      sourceTaskId: 'task-1',
      sourceEvidenceIds: ['evidence-1'],
      status: 'draft',
      riskLevel: 'medium',
      confidence: 0.82,
      createdBy: {
        id: 'agent-1',
        label: 'Supervisor',
        kind: 'agent'
      },
      createdAt: '2026-04-26T00:30:00.000Z',
      updatedAt: '2026-04-26T00:45:00.000Z',
      install: {
        receiptId: 'receipt-1',
        skillId: 'workspace-draft-draft-1',
        sourceId: 'workspace-skill-drafts',
        status: 'installed',
        phase: 'installed',
        installedAt: '2026-04-26T00:50:00.000Z'
      },
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: 'task-1',
        sourceEvidenceIds: ['evidence-1'],
        manifestId: 'workspace-draft-draft-1',
        manifestSourceId: 'workspace-skill-drafts'
      },
      lifecycle: {
        draftStatus: 'draft',
        installStatus: 'installed',
        reusable: true,
        nextAction: 'ready_to_reuse'
      }
    }
  ],
  reuseRecords: []
};

function makeWorkspaceCenterWithDraftStatuses(
  statuses: WorkspaceCenterRecord['drafts'][number]['status'][]
): WorkspaceCenterRecord {
  return {
    ...workspaceCenter,
    drafts: statuses.map((status, index) => ({
      ...workspaceCenter.drafts[0],
      id: `draft-${status}`,
      title: `${status} draft`,
      status,
      updatedAt: `2026-04-26T00:4${index}:00.000Z`
    }))
  };
}

function actionButtonsByDraftOrder() {
  return buttonCalls.buttons.filter(button => {
    const text = getButtonText(button.children);
    return text.includes('批准') || text.includes('拒绝');
  });
}

describe('WorkspaceCenterPanel', () => {
  beforeEach(() => {
    buttonCalls.buttons.length = 0;
  });

  it('renders workspace identity, draft counts, draft cards and approval controls', () => {
    const onApproveDraft = vi.fn();
    const onRejectDraft = vi.fn();

    const html = renderToStaticMarkup(
      <WorkspaceCenterPanel
        workspaceCenter={workspaceCenter}
        onApproveDraft={onApproveDraft}
        onRejectDraft={onRejectDraft}
      />
    );

    expect(html).toContain('Agent Workspace MVP');
    expect(html).toContain('活跃草稿');
    expect(html).toContain('2');
    expect(html).toContain('已批准草稿');
    expect(html).toContain('5');
    expect(html).toContain('Reuse browser evidence');
    expect(html).toContain('Turn repeated evidence browsing into a reusable skill.');
    expect(html).toContain('browser.open');
    expect(html).toContain('安装状态');
    expect(html).toContain('installed');
    expect(html).toContain('receipt-1');
    expect(buttonCalls.buttons.map(button => getButtonText(button.children)).join(' ')).toContain('批准');
    expect(buttonCalls.buttons.map(button => getButtonText(button.children)).join(' ')).toContain('拒绝');

    buttonCalls.buttons.find(button => getButtonText(button.children).includes('批准'))?.onClick?.();
    buttonCalls.buttons.find(button => getButtonText(button.children).includes('拒绝'))?.onClick?.();

    expect(onApproveDraft).toHaveBeenCalledWith('draft-1');
    expect(onRejectDraft).toHaveBeenCalledWith('draft-1');
  });

  it('only enables approve and reject actions for draft and shadow skill drafts', () => {
    const onApproveDraft = vi.fn();
    const onRejectDraft = vi.fn();

    renderToStaticMarkup(
      <WorkspaceCenterPanel
        workspaceCenter={makeWorkspaceCenterWithDraftStatuses([
          'draft',
          'shadow',
          'active',
          'trusted',
          'rejected',
          'retired'
        ])}
        onApproveDraft={onApproveDraft}
        onRejectDraft={onRejectDraft}
      />
    );

    const actionButtons = actionButtonsByDraftOrder();

    expect(actionButtons).toHaveLength(12);
    expect(actionButtons.map(button => button.disabled)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true
    ]);

    for (const button of actionButtons) {
      if (!button.disabled) {
        button.onClick?.();
      }
    }

    expect(onApproveDraft).toHaveBeenCalledTimes(2);
    expect(onApproveDraft).toHaveBeenNthCalledWith(1, 'draft-draft');
    expect(onApproveDraft).toHaveBeenNthCalledWith(2, 'draft-shadow');
    expect(onRejectDraft).toHaveBeenCalledTimes(2);
    expect(onRejectDraft).toHaveBeenNthCalledWith(1, 'draft-draft');
    expect(onRejectDraft).toHaveBeenNthCalledWith(2, 'draft-shadow');
  });

  it('renders read-only lifecycle action grouping and install failure details for skill drafts', () => {
    const onApproveDraft = vi.fn();
    const onRejectDraft = vi.fn();
    const workspaceCenterWithLifecycleSignals: WorkspaceCenterRecord = {
      ...workspaceCenter,
      drafts: [
        {
          ...workspaceCenter.drafts[0],
          id: 'draft-install',
          title: 'Install pending draft',
          install: {
            receiptId: 'receipt-install',
            skillId: 'workspace-draft-draft-install',
            sourceId: 'workspace-skill-drafts',
            status: 'approved',
            phase: 'approved'
          },
          lifecycle: {
            draftStatus: 'draft',
            installStatus: 'approved',
            reusable: false,
            nextAction: 'install_from_skill_lab'
          }
        },
        {
          ...workspaceCenter.drafts[0],
          id: 'draft-failed',
          title: 'Failed install draft',
          install: {
            receiptId: 'receipt-failed',
            skillId: 'workspace-draft-draft-failed',
            sourceId: 'workspace-skill-drafts',
            status: 'failed',
            phase: 'failed',
            failureCode: 'checksum_mismatch'
          },
          lifecycle: {
            draftStatus: 'draft',
            installStatus: 'failed',
            reusable: false,
            nextAction: 'retry_install'
          }
        }
      ]
    };

    const html = renderToStaticMarkup(
      <WorkspaceCenterPanel
        workspaceCenter={workspaceCenterWithLifecycleSignals}
        onApproveDraft={onApproveDraft}
        onRejectDraft={onRejectDraft}
      />
    );

    expect(html).toContain('Lifecycle 分组');
    expect(html).toContain('从 Skill Lab 安装');
    expect(html).toContain('重试安装');
    expect(html).toContain('安装失败');
    expect(html).toContain('checksum_mismatch');
  });
});
