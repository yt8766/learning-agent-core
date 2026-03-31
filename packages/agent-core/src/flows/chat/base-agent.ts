import { z } from 'zod/v4';

import { AgentExecutionState, AgentRole } from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { ChatMessage } from '../../adapters/llm/llm-provider';

export abstract class BaseAgent {
  protected readonly state: AgentExecutionState;

  constructor(
    protected readonly role: AgentRole,
    protected readonly context: AgentRuntimeContext
  ) {
    this.state = {
      agentId: `${role}_${context.taskId}`,
      role,
      goal: context.goal,
      plan: [],
      toolCalls: [],
      observations: [],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'idle'
    };
  }

  getState(): AgentExecutionState {
    return this.state;
  }

  protected setStatus(status: AgentExecutionState['status']): void {
    this.state.status = status;
  }

  protected remember(content: string): void {
    this.state.shortTermMemory.push(content);
    this.state.observations.push(content);
  }

  protected setSubTask(subTask: string): void {
    this.state.subTask = subTask;
  }

  protected async generateObject<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
    options: { role: 'manager' | 'research' | 'executor' | 'reviewer'; thinking: boolean }
  ): Promise<T | null> {
    if (!this.context.llm.isConfigured()) {
      return null;
    }

    return this.withModelFallback(
      async modelId =>
        this.context.llm.generateObject(messages, schema, {
          role: options.role,
          taskId: this.context.taskId,
          modelId,
          budgetState: this.context.budgetState,
          thinking: options.thinking,
          temperature: 0.1,
          onUsage: usage => {
            this.context.onUsage?.({
              usage,
              role: options.role
            });
          }
        }),
      error => `LLM object generation fallback: ${error instanceof Error ? error.message : 'unknown error'}`,
      options.role
    );
  }

  protected async generateText(
    messages: ChatMessage[],
    options: { role: 'manager' | 'research' | 'executor' | 'reviewer'; thinking: boolean }
  ): Promise<string | null> {
    if (!this.context.llm.isConfigured()) {
      return null;
    }

    return this.withModelFallback(
      async modelId =>
        this.context.llm.generateText(messages, {
          role: options.role,
          taskId: this.context.taskId,
          modelId,
          budgetState: this.context.budgetState,
          thinking: options.thinking,
          temperature: 0.2,
          onUsage: usage => {
            this.context.onUsage?.({
              usage,
              role: options.role
            });
          }
        }),
      error => `LLM text generation fallback: ${error instanceof Error ? error.message : 'unknown error'}`,
      options.role
    );
  }

  protected async streamText(
    messages: ChatMessage[],
    options: { role: 'manager' | 'research' | 'executor' | 'reviewer'; thinking: boolean; messageId: string }
  ): Promise<string | null> {
    if (!this.context.llm.isConfigured()) {
      return null;
    }

    return this.withModelFallback(
      async modelId =>
        this.context.llm.streamText(
          messages,
          {
            role: options.role,
            taskId: this.context.taskId,
            modelId,
            budgetState: this.context.budgetState,
            thinking: options.thinking,
            temperature: 0.2,
            onUsage: usage => {
              this.context.onUsage?.({
                usage,
                role: options.role
              });
            }
          },
          (token, metadata) => {
            this.context.onToken?.({
              token,
              role: options.role,
              messageId: options.messageId,
              model: metadata?.model
            });
          }
        ),
      error => `LLM streaming fallback: ${error instanceof Error ? error.message : 'unknown error'}`,
      options.role
    );
  }

  private async withModelFallback<T>(
    invoke: (modelId?: string) => Promise<T>,
    buildFallbackNote: (error: unknown) => string,
    role: 'manager' | 'research' | 'executor' | 'reviewer'
  ): Promise<T | null> {
    const primaryModelId = this.context.currentWorker?.defaultModel;
    const fallbackModelId = this.context.budgetState?.fallbackModelId;

    try {
      return await invoke(primaryModelId);
    } catch (error) {
      if (!this.shouldFallbackModel(error) || !fallbackModelId || fallbackModelId === primaryModelId) {
        this.remember(buildFallbackNote(error));
        return null;
      }

      this.remember(
        `Primary model ${primaryModelId ?? 'default'} unavailable, retrying with fallback model ${fallbackModelId}.`
      );
      this.context.onModelEvent?.({
        role,
        modelUsed: fallbackModelId,
        isFallback: true,
        fallbackReason: error instanceof Error ? error.message : String(error ?? 'unknown error'),
        status: 'fallback'
      });
      try {
        return await invoke(fallbackModelId);
      } catch (fallbackError) {
        this.remember(buildFallbackNote(fallbackError));
        this.context.onModelEvent?.({
          role,
          modelUsed: fallbackModelId,
          isFallback: true,
          fallbackReason:
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError ?? 'unknown error'),
          status: 'failed'
        });
        return null;
      }
    }
  }

  private shouldFallbackModel(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /429|500|502|503|timeout|timed out|stream/i.test(message);
  }
}
