import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutionWatchdog } from '../src/watchdog';

describe('ExecutionWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the original result when no timeout or interaction signal is detected', async () => {
    const watchdog = new ExecutionWatchdog();

    const result = await watchdog.guard(
      {
        taskId: 'task-1',
        toolName: 'web.search_query',
        request: {
          taskId: 'task-1',
          toolName: 'web.search_query',
          intent: 'read_file',
          input: {},
          requestedBy: 'agent'
        }
      },
      async () => ({
        ok: true,
        outputSummary: 'normal output',
        durationMs: 12
      })
    );

    expect(result).toEqual({
      ok: true,
      outputSummary: 'normal output',
      durationMs: 12
    });
  });

  it('returns a timeout result when execution stalls beyond the watchdog threshold', async () => {
    const watchdog = new ExecutionWatchdog();

    const resultPromise = watchdog.guard(
      {
        taskId: 'task-2',
        toolName: 'mcp.call',
        serverId: 'srv-1',
        capabilityId: 'cap-1',
        timeoutMs: 1000,
        request: {
          taskId: 'task-2',
          toolName: 'mcp.call',
          intent: 'call_external_api',
          input: { q: 'latest' },
          requestedBy: 'agent'
        }
      },
      () => new Promise(() => undefined)
    );

    await vi.advanceTimersByTimeAsync(900);
    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      outputSummary: 'Execution watchdog detected a stall while waiting for mcp.call.',
      errorMessage: 'watchdog_timeout',
      durationMs: 900,
      exitCode: 124,
      serverId: 'srv-1',
      capabilityId: 'cap-1',
      rawOutput: {
        watchdogTriggered: true,
        recommendedAction: 'continue-or-cancel',
        lastOutputSnippet: '',
        reason: 'timeout'
      }
    });
  });

  it('converts suspicious interactive output into a watchdog interaction result', () => {
    const watchdog = new ExecutionWatchdog();

    const result = watchdog.observe({
      taskId: 'task-3',
      toolName: 'terminal.exec',
      request: {
        taskId: 'task-3',
        toolName: 'terminal.exec',
        intent: 'read_file',
        input: {},
        requestedBy: 'agent'
      },
      result: {
        ok: true,
        outputSummary: 'Please confirm and press any key to continue',
        durationMs: 24,
        rawOutput: {
          previous: 'value'
        }
      }
    });

    expect(result).toEqual({
      ok: false,
      outputSummary: 'Please confirm and press any key to continue',
      durationMs: 24,
      errorMessage: 'watchdog_interaction_required',
      rawOutput: {
        previous: 'value',
        watchdogTriggered: true,
        recommendedAction: 'manual-input',
        lastOutputSnippet: 'Please confirm and press any key to continue',
        reason: 'interaction_required'
      }
    });
  });

  it('extracts snippets from raw output objects and ignores missing observations', () => {
    const watchdog = new ExecutionWatchdog();

    expect(
      watchdog.observe({
        taskId: 'task-4',
        toolName: 'terminal.exec',
        request: {
          taskId: 'task-4',
          toolName: 'terminal.exec',
          intent: 'read_file',
          input: {},
          requestedBy: 'agent'
        }
      })
    ).toBeUndefined();

    const result = watchdog.observe({
      taskId: 'task-5',
      toolName: 'terminal.exec',
      request: {
        taskId: 'task-5',
        toolName: 'terminal.exec',
        intent: 'read_file',
        input: {},
        requestedBy: 'agent'
      },
      result: {
        ok: true,
        outputSummary: '',
        durationMs: 31,
        rawOutput: {
          prompt: 'Enter password for sudo'
        }
      }
    });

    expect(result).toMatchObject({
      ok: false,
      errorMessage: 'watchdog_interaction_required'
    });
    expect((result?.rawOutput as Record<string, unknown>).lastOutputSnippet).toContain('Enter password');
  });
});
