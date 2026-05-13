import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AgentRole } from '@agent/core';

vi.mock('../../../src/bridges/supervisor-runtime-bridge', () => ({
  mergeEvidence: vi.fn().mockImplementation((existing: any[], newItems: any[]) => [...existing, ...newItems])
}));

import {
  announceSkillStep,
  buildCurrentSkillExecution,
  setSkillStepStatus,
  appendExecutionEvidence
} from '../../../src/flows/runtime-stage/runtime-stage-helpers';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'running',
    trace: [],
    externalSources: [],
    capabilityAttachments: [],
    plan: { subTasks: [] },
    currentSkillExecution: undefined,
    updatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    requestedHints: {},
    ...overrides
  } as any;
}

describe('runtime-stage-helpers extended (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildCurrentSkillExecution', () => {
    it('returns undefined when no compiled skill attachment', () => {
      expect(buildCurrentSkillExecution(makeTask(), 'research')).toBeUndefined();
    });

    it('returns execution record when matching step found', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            kind: 'skill',
            enabled: true,
            id: 'skill-1',
            sourceId: 'src-1',
            displayName: 'Test Skill',
            owner: { ownerType: 'user-attached' },
            metadata: {
              steps: [
                { title: 'Search', instruction: 'Search docs', toolNames: ['webSearch'] },
                { title: 'Write', instruction: 'Write', toolNames: ['write_file'] }
              ]
            }
          }
        ],
        requestedHints: { requestedSkill: 'test' }
      });
      const result = buildCurrentSkillExecution(task, 'research');
      expect(result).toBeDefined();
      expect(result!.displayName).toBe('Test Skill');
    });

    it('falls back to user-attached skill', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            kind: 'skill',
            enabled: true,
            id: 'skill-1',
            displayName: 'Skill',
            owner: { ownerType: 'user-attached' },
            metadata: { steps: [{ title: 'Step', instruction: 'Do it', toolNames: ['write_file'] }] }
          }
        ],
        requestedHints: {}
      });
      expect(buildCurrentSkillExecution(task, 'execute')).toBeDefined();
    });
  });

  describe('setSkillStepStatus', () => {
    it('does nothing when no attachment', () => {
      setSkillStepStatus(makeTask(), 'research', 'running');
    });

    it('updates matching subtask status', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            kind: 'skill',
            enabled: true,
            id: 'skill-1',
            displayName: 'Skill',
            owner: { ownerType: 'user-attached' },
            metadata: { steps: [{ title: 'Step', instruction: 'Do it' }] }
          }
        ],
        plan: { subTasks: [{ id: 'skill_step:skill-1:1', assignedTo: AgentRole.RESEARCH, status: 'pending' }] },
        currentSkillExecution: { phase: 'research', stepIndex: 1 }
      });
      setSkillStepStatus(task, 'research', 'running');
      expect(task.plan.subTasks[0].status).toBe('running');
    });
  });

  describe('announceSkillStep', () => {
    it('does nothing when no currentSkillExecution', () => {
      const callbacks = { addTrace: vi.fn(), addProgressDelta: vi.fn() };
      announceSkillStep(makeTask(), 'research', callbacks);
      expect(callbacks.addTrace).not.toHaveBeenCalled();
    });

    it('announces skill step with matching attachment', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            kind: 'skill',
            enabled: true,
            id: 'skill-1',
            sourceId: 'src-1',
            displayName: 'Test Skill',
            owner: { ownerType: 'user-attached' },
            metadata: { steps: [{ title: 'Search', instruction: 'Search', toolNames: ['webSearch'] }] }
          }
        ],
        requestedHints: { requestedSkill: 'test' },
        currentSkillExecution: { phase: 'research', stepIndex: 1, totalSteps: 1, title: 'Search' }
      });
      const callbacks = { addTrace: vi.fn(), addProgressDelta: vi.fn() };
      announceSkillStep(task, 'research', callbacks);
      expect(callbacks.addTrace).toHaveBeenCalled();
    });
  });

  describe('appendExecutionEvidence', () => {
    it('creates evidence from results array', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'webSearchPrime', {
        outputSummary: 'searched',
        rawOutput: { results: [{ url: 'https://example.com', summary: 'Example', sourceType: 'web' }] }
      });
      expect(task.externalSources.length).toBeGreaterThan(0);
    });

    it('creates evidence from items array', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'http_request', {
        outputSummary: 'fetched',
        rawOutput: { items: [{ url: 'https://example.com', snippet: 'Snippet' }] }
      });
      expect(task.externalSources.length).toBeGreaterThan(0);
    });

    it('creates single evidence record when no results/items', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'browse_page', {
        outputSummary: 'browsed',
        rawOutput: { url: 'https://example.com', summary: 'Page', snapshotSummary: 'Snap' }
      });
      expect(task.externalSources.length).toBeGreaterThan(0);
    });

    it('skips items without sourceType', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'unknown_tool', {
        outputSummary: 'test',
        rawOutput: { results: [{ url: 'https://example.com' }] }
      });
      expect(task.externalSources).toEqual([]);
    });

    it('handles browse_page replay fields', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'browse_page', {
        outputSummary: 'browsed',
        rawOutput: {
          url: 'https://example.com',
          summary: 'Page',
          sessionId: 'sess-1',
          snapshotSummary: 'Snap',
          screenshotRef: 'ref-1'
        }
      });
      expect(task.externalSources.length).toBeGreaterThan(0);
      expect(task.externalSources[0].replay).toBeDefined();
    });
  });
});
