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

    try {
      return await this.context.llm.generateObject(messages, schema, {
        role: options.role,
        thinking: options.thinking,
        temperature: 0.1,
        onUsage: usage => {
          this.context.onUsage?.({
            usage,
            role: options.role
          });
        }
      });
    } catch (error) {
      this.remember(`LLM object generation fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  protected async generateText(
    messages: ChatMessage[],
    options: { role: 'manager' | 'research' | 'executor' | 'reviewer'; thinking: boolean }
  ): Promise<string | null> {
    if (!this.context.llm.isConfigured()) {
      return null;
    }

    try {
      return await this.context.llm.generateText(messages, {
        role: options.role,
        thinking: options.thinking,
        temperature: 0.2,
        onUsage: usage => {
          this.context.onUsage?.({
            usage,
            role: options.role
          });
        }
      });
    } catch (error) {
      this.remember(`LLM text generation fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  protected async streamText(
    messages: ChatMessage[],
    options: { role: 'manager' | 'research' | 'executor' | 'reviewer'; thinking: boolean; messageId: string }
  ): Promise<string | null> {
    if (!this.context.llm.isConfigured()) {
      return null;
    }

    try {
      return await this.context.llm.streamText(
        messages,
        {
          role: options.role,
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
      );
    } catch (error) {
      this.remember(`LLM streaming fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }
}
