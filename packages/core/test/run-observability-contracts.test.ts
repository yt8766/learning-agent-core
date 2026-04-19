import { describe, expect, it } from 'vitest';

import {
  RunBundleRecordSchema,
  RunDiagnosticKindSchema,
  RunDiagnosticSeveritySchema,
  RunStageSchema,
  RunTimelineItemRecordSchema,
  RunTraceSpanRecordSchema
} from '../src';

describe('@agent/core run observability contracts', () => {
  it('parses a minimal run bundle with timeline, trace, checkpoint, and diagnostics', () => {
    expect(
      RunBundleRecordSchema.parse({
        run: {
          taskId: 'task-1',
          goal: 'Investigate observability gaps',
          lineage: {
            parentTaskId: 'task-0',
            launchReason: 'replay',
            replaySourceLabel: 'trace · execution_bridge',
            replayScoped: true,
            baselineTaskId: 'task-0'
          },
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          hasInterrupt: false,
          hasFallback: true,
          hasRecoverableCheckpoint: true,
          hasEvidenceWarning: false,
          diagnosticFlags: ['fallback']
        },
        timeline: [
          {
            id: 'tl-1',
            stage: 'execution',
            status: 'running',
            title: '工部执行',
            summary: '进入执行阶段',
            startedAt: '2026-04-19T10:01:00.000Z'
          }
        ],
        traces: [
          {
            spanId: 'span-1',
            node: 'execution_bridge',
            stage: 'execution',
            status: 'started',
            summary: '派发到工部执行链',
            startedAt: '2026-04-19T10:01:00.000Z',
            isFallback: true
          }
        ],
        checkpoints: [
          {
            checkpointId: 'cp-1',
            summary: '可从执行阶段恢复',
            createdAt: '2026-04-19T10:01:05.000Z',
            recoverable: true,
            recoverability: 'safe'
          }
        ],
        interrupts: [],
        diagnostics: [
          {
            id: 'diag-1',
            kind: 'fallback',
            severity: 'warning',
            title: '发生模型回退',
            summary: '主模型不可用，已切到后备模型',
            detectedAt: '2026-04-19T10:01:02.000Z'
          }
        ],
        artifacts: [],
        evidence: []
      })
    ).toMatchObject({
      run: {
        taskId: 'task-1',
        lineage: expect.objectContaining({
          parentTaskId: 'task-0',
          launchReason: 'replay'
        })
      },
      timeline: [
        expect.objectContaining({
          stage: 'execution'
        })
      ]
    });
  });

  it('rejects unsupported run stages and diagnostic enums', () => {
    expect(() => RunStageSchema.parse('ship')).toThrow();
    expect(() => RunDiagnosticKindSchema.parse('approval_waiting')).toThrow();
    expect(() => RunDiagnosticSeveritySchema.parse('fatal')).toThrow();
  });

  it('rejects timeline items without the canonical stage semantics', () => {
    expect(() =>
      RunTimelineItemRecordSchema.parse({
        id: 'tl-1',
        stage: 'ship',
        status: 'running',
        title: '非法阶段',
        summary: '不应通过'
      })
    ).toThrow();
  });

  it('rejects trace spans without a started timestamp', () => {
    expect(() =>
      RunTraceSpanRecordSchema.parse({
        spanId: 'span-1',
        node: 'execution_bridge',
        stage: 'execution',
        status: 'started',
        summary: '缺少 startedAt'
      })
    ).toThrow();
  });
});
