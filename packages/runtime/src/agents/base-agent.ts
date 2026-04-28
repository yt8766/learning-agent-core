import {
  AgentRole,
  type AgentExecutionState,
  type AgentRoleValue,
  type LlmProviderMessage as ChatMessage
} from '@agent/core';
import {
  generateObjectWithRetry,
  generateTextWithRetry,
  streamTextWithRetry,
  withFallbackModel,
  withReactiveContextRetry
} from '@agent/adapters';

import type { AgentRuntimeContext } from '../runtime/agent-runtime-context';

export abstract class BaseAgent {
  protected readonly state: AgentExecutionState;

  constructor(
    protected readonly role: AgentRoleValue,
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
    schema: Parameters<typeof generateObjectWithRetry<T>>[0]['schema'],
    options: { role: 'manager' | 'research' | 'executor' | 'reviewer'; thinking: boolean }
  ): Promise<T | null> {
    if (!this.context.llm.isConfigured()) {
      return null;
    }

    return this.withModelFallback(
      async modelId =>
        withReactiveContextRetry({
          context: this.context,
          trigger: `${options.role}-object`,
          messages,
          invoke: async compactedMessages =>
            generateObjectWithRetry({
              llm: this.context.llm,
              contractName: `${options.role}-base-agent-object`,
              contractVersion: '1.0.0',
              messages: compactedMessages,
              schema,
              options: {
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
              }
            })
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
        withReactiveContextRetry({
          context: this.context,
          trigger: `${options.role}-text`,
          messages,
          invoke: async compactedMessages =>
            generateTextWithRetry({
              llm: this.context.llm,
              messages: compactedMessages,
              options: {
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
              }
            })
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
        streamTextWithRetry({
          llm: this.context.llm,
          messages,
          options: {
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
          onToken: (token, metadata) => {
            this.context.onToken?.({
              token,
              role: options.role,
              messageId: options.messageId,
              model: metadata?.model
            });
          }
        }),
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
    return withFallbackModel({
      primaryModelId,
      fallbackModelId,
      role,
      invoke,
      onPrimaryFailure: error => {
        this.remember(buildFallbackNote(error));
      },
      onFallbackStart: (nextModelId, error) => {
        this.remember(
          `Primary model ${primaryModelId ?? 'default'} unavailable, retrying with fallback model ${nextModelId}.`
        );
        this.context.onModelEvent?.({
          role,
          modelUsed: nextModelId,
          isFallback: true,
          fallbackReason: error instanceof Error ? error.message : String(error ?? 'unknown error'),
          status: 'fallback'
        });
      },
      onFallbackFailure: (nextModelId, error) => {
        this.remember(buildFallbackNote(error));
        this.context.onModelEvent?.({
          role,
          modelUsed: nextModelId,
          isFallback: true,
          fallbackReason: error instanceof Error ? error.message : String(error ?? 'unknown error'),
          status: 'failed'
        });
      }
    });
  }
}
