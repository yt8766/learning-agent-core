import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/core';

export interface ExecutionWatchdogObservation {
  taskId: string;
  toolName: string;
  serverId?: string;
  capabilityId?: string;
  timeoutMs?: number;
  request: ToolExecutionRequest;
  result?: ToolExecutionResult;
}

export class ExecutionWatchdog {
  async guard<T extends ToolExecutionResult>(
    observation: Omit<ExecutionWatchdogObservation, 'result'>,
    run: () => Promise<T>
  ): Promise<T | ToolExecutionResult> {
    const timeoutMs = observation.timeoutMs ? Math.max(1, Math.floor(observation.timeoutMs * 0.9)) : undefined;
    const startedAt = Date.now();
    const timeoutPromise =
      timeoutMs === undefined
        ? undefined
        : new Promise<ToolExecutionResult>(resolve => {
            setTimeout(() => {
              resolve({
                ok: false,
                outputSummary: `Execution watchdog detected a stall while waiting for ${observation.toolName}.`,
                errorMessage: 'watchdog_timeout',
                durationMs: Date.now() - startedAt,
                exitCode: 124,
                serverId: observation.serverId,
                capabilityId: observation.capabilityId,
                rawOutput: {
                  watchdogTriggered: true,
                  recommendedAction: 'continue-or-cancel',
                  lastOutputSnippet: '',
                  reason: 'timeout'
                }
              });
            }, timeoutMs);
          });

    const result = timeoutPromise ? await Promise.race([run(), timeoutPromise]) : await run();
    return (
      this.observe({
        ...observation,
        result
      }) ?? result
    );
  }

  observe(observation: ExecutionWatchdogObservation): ToolExecutionResult | undefined {
    const result = observation.result;
    if (!result) {
      return undefined;
    }
    const snippet = extractOutputSnippet(result);
    if (/(password|passphrase|press any key|confirm|are you sure|tty|interactive prompt)/i.test(snippet)) {
      return {
        ...result,
        ok: false,
        errorMessage: 'watchdog_interaction_required',
        rawOutput: {
          ...(isObject(result.rawOutput) ? result.rawOutput : {}),
          watchdogTriggered: true,
          recommendedAction: 'manual-input',
          lastOutputSnippet: snippet,
          reason: 'interaction_required'
        }
      };
    }
    return undefined;
  }
}

function extractOutputSnippet(result: ToolExecutionResult) {
  if (typeof result.outputSummary === 'string' && result.outputSummary.trim()) {
    return result.outputSummary.slice(0, 240);
  }
  if (isObject(result.rawOutput)) {
    const raw = JSON.stringify(result.rawOutput);
    return raw.slice(0, 240);
  }
  return '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
