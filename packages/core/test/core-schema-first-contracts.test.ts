import { describe, expect, it } from 'vitest';

import type {
  ArchitectureDescriptorRegistryEntry,
  DeliverySourceSummaryRecord,
  ExecutionTraceSummaryRecord,
  PlatformApprovalRecord,
  SharedPlatformConsoleRecord,
  WorkflowRouteContext,
  WorkflowRouteResult
} from '../src';
import {
  ArchitectureDescriptorSchema,
  ArchitectureDiagramRecordSchema,
  DeliveryCitationRecordSchema,
  DeliverySourceSummaryRecordSchema,
  ExecutionTraceSummaryRecordSchema,
  IntentClassificationResultSchema,
  PlatformApprovalInterruptRecordSchema,
  PlatformApprovalRecordSchema,
  RoutingProfileSchema,
  RuntimeArchitectureRecordSchema,
  WorkflowRouteContextSchema,
  WorkflowRouteResultSchema
} from '../src';

describe('@agent/core schema-first contracts', () => {
  it('parses platform approval records with nested draft state', () => {
    const record: PlatformApprovalRecord = PlatformApprovalRecordSchema.parse({
      taskId: 'task-1',
      goal: 'review runtime governance',
      status: 'pending_approval',
      executionMode: 'plan',
      pendingApproval: {
        toolName: 'filesystem.write',
        intent: 'edit config',
        preview: [{ label: 'File', value: 'docs/runtime.md' }]
      },
      activeInterrupt: {
        id: 'interrupt-1',
        status: 'pending',
        mode: 'blocking',
        source: 'tool',
        kind: 'runtime-governance',
        resumeStrategy: 'approval-recovery'
      },
      planDraft: {
        summary: 'Need approval before writing config',
        autoResolved: ['target file found'],
        openQuestions: ['should we overwrite?'],
        assumptions: ['workspace is writable']
      },
      approvals: [{ decision: 'approved', reason: 'safe change' }]
    });

    expect(record.planDraft?.summary).toBe('Need approval before writing config');
    expect(record.activeInterrupt?.resumeStrategy).toBe('approval-recovery');
  });

  it('parses platform approval interrupt records', () => {
    expect(
      PlatformApprovalInterruptRecordSchema.parse({
        id: 'interrupt-2',
        status: 'resolved',
        mode: 'non-blocking',
        source: 'graph',
        kind: 'user-input',
        resumeStrategy: 'command'
      }).status
    ).toBe('resolved');
  });

  it('keeps the shared platform console container usable', () => {
    const consoleRecord: SharedPlatformConsoleRecord<{ taskCount: number }> = {
      runtime: { taskCount: 1 },
      approvals: [],
      learning: null,
      evals: null,
      skills: [],
      evidence: [],
      connectors: [],
      skillSources: null,
      companyAgents: [],
      rules: [],
      tasks: [],
      sessions: []
    };

    expect(consoleRecord.runtime.taskCount).toBe(1);
  });

  it('parses workflow route context and result contracts', () => {
    const context: WorkflowRouteContext = WorkflowRouteContextSchema.parse({
      goal: 'summarize runtime blockers',
      requestedMode: 'plan',
      requestedHints: {
        preferredMode: 'research-first'
      },
      recentTurns: [{ role: 'user', content: 'check latest blockers' }]
    });
    const result: WorkflowRouteResult = WorkflowRouteResultSchema.parse({
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'route to workflow',
      adapter: 'research-first',
      priority: 1,
      intent: 'research-first'
    });

    expect(context.recentTurns?.[0]?.role).toBe('user');
    expect(result.adapter).toBe('research-first');
  });

  it('parses workflow route classifiers and profiles', () => {
    expect(
      IntentClassificationResultSchema.parse({
        intent: 'approval-recovery',
        confidence: 0.8,
        matchedSignals: ['interrupt card']
      }).intent
    ).toBe('approval-recovery');
    expect(
      RoutingProfileSchema.parse({
        defaultMode: 'plan-first',
        prefersResearchFirst: true,
        executionTolerance: 'medium'
      }).defaultMode
    ).toBe('plan-first');
  });

  it('parses delivery and execution trace summary contracts', () => {
    const delivery: DeliverySourceSummaryRecord = DeliverySourceSummaryRecordSchema.parse({
      freshnessSourceSummary: 'repo docs refreshed',
      citations: [
        DeliveryCitationRecordSchema.parse({
          label: 'runtime-guideline',
          trustClass: 'internal'
        })
      ]
    });
    const traceSummary: ExecutionTraceSummaryRecord = ExecutionTraceSummaryRecordSchema.parse({
      citationSourceSummary: '2 trusted citations'
    });

    expect(delivery.citations?.[0]?.label).toBe('runtime-guideline');
    expect(traceSummary.citationSourceSummary).toBe('2 trusted citations');
  });

  it('parses runtime architecture records while keeping registry entries as contracts', () => {
    expect(
      ArchitectureDescriptorSchema.parse({
        id: 'project',
        title: 'Project architecture',
        scope: 'project',
        direction: 'TD',
        sourceDescriptors: ['docs/ARCHITECTURE.md'],
        subgraphs: [],
        nodes: [{ id: 'entry', label: 'Entry', kind: 'entry' }],
        edges: []
      }).scope
    ).toBe('project');
    expect(
      RuntimeArchitectureRecordSchema.parse({
        project: ArchitectureDiagramRecordSchema.parse({
          id: 'project',
          title: 'Project architecture',
          generatedAt: '2026-04-16T00:00:00.000Z',
          version: '1',
          sourceDescriptors: ['docs/ARCHITECTURE.md'],
          descriptor: {
            id: 'project',
            title: 'Project architecture',
            scope: 'project',
            direction: 'TD',
            sourceDescriptors: ['docs/ARCHITECTURE.md'],
            subgraphs: [],
            nodes: [{ id: 'entry', label: 'Entry', kind: 'entry' }],
            edges: []
          },
          mermaid: 'flowchart TD'
        }),
        agent: {
          id: 'agent',
          title: 'Agent architecture',
          generatedAt: '2026-04-16T00:00:00.000Z',
          version: '1',
          sourceDescriptors: ['docs/ARCHITECTURE.md'],
          descriptor: {
            id: 'agent',
            title: 'Agent architecture',
            scope: 'agent',
            direction: 'TD',
            sourceDescriptors: ['docs/ARCHITECTURE.md'],
            subgraphs: [],
            nodes: [{ id: 'runtime', label: 'Runtime', kind: 'runtime' }],
            edges: []
          },
          mermaid: 'flowchart TD'
        },
        agentChat: {
          id: 'agentChat',
          title: 'Chat architecture',
          generatedAt: '2026-04-16T00:00:00.000Z',
          version: '1',
          sourceDescriptors: ['docs/ARCHITECTURE.md'],
          descriptor: {
            id: 'agentChat',
            title: 'Chat architecture',
            scope: 'agentChat',
            direction: 'TD',
            sourceDescriptors: ['docs/ARCHITECTURE.md'],
            subgraphs: [],
            nodes: [{ id: 'chat', label: 'Chat', kind: 'frontend' }],
            edges: []
          },
          mermaid: 'flowchart TD'
        },
        agentAdmin: {
          id: 'agentAdmin',
          title: 'Admin architecture',
          generatedAt: '2026-04-16T00:00:00.000Z',
          version: '1',
          sourceDescriptors: ['docs/ARCHITECTURE.md'],
          descriptor: {
            id: 'agentAdmin',
            title: 'Admin architecture',
            scope: 'agentAdmin',
            direction: 'TD',
            sourceDescriptors: ['docs/ARCHITECTURE.md'],
            subgraphs: [],
            nodes: [{ id: 'admin', label: 'Admin', kind: 'frontend' }],
            edges: []
          },
          mermaid: 'flowchart TD'
        }
      }).agentAdmin.id
    ).toBe('agentAdmin');

    const registryEntry: ArchitectureDescriptorRegistryEntry = {
      id: 'project',
      sourceDescriptors: ['docs/ARCHITECTURE.md'],
      build: () => ({
        id: 'project',
        title: 'Project architecture',
        scope: 'project',
        direction: 'TD',
        sourceDescriptors: ['docs/ARCHITECTURE.md'],
        subgraphs: [],
        nodes: [],
        edges: []
      })
    };

    expect(registryEntry.build().scope).toBe('project');
  });
});
