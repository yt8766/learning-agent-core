import { describe, expect, it, vi } from 'vitest';
import { ActionIntent } from '@agent/core';

import { executeRuntimeGovernanceTool } from '../../../src/executors/runtime-governance/runtime-governance-executor';

describe('executeRuntimeGovernanceTool extended coverage', () => {
  function makeRepository() {
    return {
      archiveThread: vi.fn().mockResolvedValue(undefined),
      recordCancellation: vi.fn().mockResolvedValue(undefined),
      recordRecovery: vi.fn().mockResolvedValue(undefined),
      listRuntimeArtifacts: vi.fn().mockResolvedValue({ items: [] })
    };
  }

  function makeRequest(toolName: string, input: Record<string, unknown> = {}) {
    return {
      taskId: 'task-1',
      toolName,
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent' as const,
      input
    };
  }

  it('returns undefined for unknown tool name', async () => {
    const result = await executeRuntimeGovernanceTool(makeRequest('unknown_tool'));
    expect(result).toBeUndefined();
  });

  describe('archive_thread', () => {
    it('throws when sessionId is empty', async () => {
      await expect(executeRuntimeGovernanceTool(makeRequest('archive_thread', { sessionId: '' }))).rejects.toThrow(
        'archive_thread requires sessionId.'
      );
    });

    it('archives thread with reason', async () => {
      const repo = makeRepository();
      const result = await executeRuntimeGovernanceTool(
        makeRequest('archive_thread', { sessionId: 'sess-1', reason: 'completed' }),
        { repository: repo as any }
      );

      expect(repo.archiveThread).toHaveBeenCalled();
      expect(result?.outputSummary).toContain('sess-1');
      expect(result?.rawOutput.reason).toBe('completed');
    });

    it('defaults reason to empty string when not provided', async () => {
      const repo = makeRepository();
      const result = await executeRuntimeGovernanceTool(makeRequest('archive_thread', { sessionId: 'sess-1' }), {
        repository: repo as any
      });

      expect(result?.rawOutput.reason).toBe('');
    });
  });

  describe('schedule_cancel', () => {
    it('throws when runId is empty', async () => {
      await expect(executeRuntimeGovernanceTool(makeRequest('schedule_cancel', { runId: '' }))).rejects.toThrow(
        'schedule_cancel requires runId.'
      );
    });

    it('records cancellation', async () => {
      const repo = makeRepository();
      const result = await executeRuntimeGovernanceTool(
        makeRequest('schedule_cancel', { runId: 'run-1', reason: 'user cancel' }),
        { repository: repo as any }
      );

      expect(repo.recordCancellation).toHaveBeenCalled();
      expect(result?.outputSummary).toContain('run-1');
    });
  });

  describe('recover_run', () => {
    it('throws when runId is empty', async () => {
      await expect(executeRuntimeGovernanceTool(makeRequest('recover_run', { runId: '' }))).rejects.toThrow(
        'recover_run requires runId.'
      );
    });

    it('records recovery with checkpointId', async () => {
      const repo = makeRepository();
      const result = await executeRuntimeGovernanceTool(
        makeRequest('recover_run', { runId: 'run-1', checkpointId: 'cp-1' }),
        { repository: repo as any }
      );

      expect(repo.recordRecovery).toHaveBeenCalled();
      expect(result?.rawOutput.checkpointId).toBe('cp-1');
    });

    it('defaults checkpointId to undefined when not provided', async () => {
      const repo = makeRepository();
      const result = await executeRuntimeGovernanceTool(makeRequest('recover_run', { runId: 'run-1' }), {
        repository: repo as any
      });

      expect(result?.rawOutput.checkpointId).toBeUndefined();
    });
  });

  describe('list_runtime_artifacts', () => {
    it('lists artifacts with default kind "all"', async () => {
      const repo = makeRepository();
      const result = await executeRuntimeGovernanceTool(makeRequest('list_runtime_artifacts'), {
        repository: repo as any
      });

      expect(repo.listRuntimeArtifacts).toHaveBeenCalledWith('all');
      expect(result?.outputSummary).toContain('all');
    });

    it('lists artifacts with specific kind', async () => {
      const repo = makeRepository();
      await executeRuntimeGovernanceTool(makeRequest('list_runtime_artifacts', { kind: 'browser-replays' }), {
        repository: repo as any
      });

      expect(repo.listRuntimeArtifacts).toHaveBeenCalledWith('browser-replays');
    });
  });
});
