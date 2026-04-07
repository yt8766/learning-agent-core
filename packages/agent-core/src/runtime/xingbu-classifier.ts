import { z } from 'zod/v4';
import type { ActionIntent, ToolDefinition } from '@agent/shared';
import type { LlmProvider } from '../adapters/llm/llm-provider';

export interface XingbuClassifierInput {
  intent: ActionIntent;
  tool: ToolDefinition;
  input?: {
    executionMode?: string;
    currentMinistry?: string;
    currentWorker?: string;
    profile?: string;
    command?: string;
    path?: string;
    fromPath?: string;
    toPath?: string;
    url?: string;
    method?: string;
  };
}

export class XingbuClassifier {
  constructor(private readonly llm: LlmProvider) {}

  async classify(input: XingbuClassifierInput): Promise<{ decision: 'allow' | 'ask' | 'deny'; reason: string }> {
    const heuristic = classifyHeuristically(input);
    if (!this.llm.isConfigured()) {
      return heuristic;
    }

    try {
      const schema = z.object({
        decision: z.enum(['allow', 'ask', 'deny']),
        reason: z.string()
      });
      const result = await this.llm.generateObject(
        [
          {
            role: 'system',
            content:
              '你是刑部前置治理分类器。仅根据工具元数据、命令/路径/URL 预览、执行模式和当前属官，输出 allow、ask、deny 三选一。对明显危险操作 deny；对有副作用但可能合理的边界动作 ask；对安全且受控的动作 allow。'
          },
          {
            role: 'user',
            content: JSON.stringify(input)
          }
        ],
        schema,
        {
          role: 'reviewer',
          taskId: `xingbu_classifier:${input.tool.name}`,
          thinking: false,
          temperature: 0
        }
      );
      return result;
    } catch {
      return heuristic;
    }
  }
}

function classifyHeuristically(input: XingbuClassifierInput): { decision: 'allow' | 'ask' | 'deny'; reason: string } {
  if (input.tool.name === 'run_terminal') {
    const command = String(input.input?.command ?? '');
    if (/\b(curl|wget).*(\||>)\b/i.test(command)) {
      return { decision: 'deny', reason: '刑部判定该终端命令包含下载后直接执行/写入风险，已阻断。' };
    }
    if (/\b(git push|pnpm publish|npm publish|deploy|release)\b/i.test(command)) {
      return { decision: 'ask', reason: '刑部判定该终端命令涉及发布或外部侧效应，需要人工确认。' };
    }
    return { decision: 'ask', reason: '刑部判定该终端命令存在边界风险，建议人工确认。' };
  }

  if (input.tool.family === 'filesystem') {
    const path = String(input.input?.path ?? input.input?.fromPath ?? input.input?.toPath ?? '');
    if (/package(-lock)?\.json$|pnpm-lock\.yaml$|\.github\/workflows\//i.test(path)) {
      return { decision: 'ask', reason: '刑部判定目标路径影响依赖或 CI 配置，需要人工确认。' };
    }
    return { decision: 'allow', reason: '刑部判定该工作区文件操作风险可控，允许继续。' };
  }

  if (input.tool.name === 'http_request') {
    const method = String(input.input?.method ?? 'GET').toUpperCase();
    if (['DELETE', 'PATCH'].includes(method)) {
      return { decision: 'deny', reason: `刑部判定 ${method} 外部写请求风险过高，已阻断。` };
    }
    return { decision: 'ask', reason: `刑部判定 ${method} 外部写请求仍需人工确认。` };
  }

  return { decision: 'ask', reason: '刑部未能快速确认该边界动作安全性，建议人工确认。' };
}
