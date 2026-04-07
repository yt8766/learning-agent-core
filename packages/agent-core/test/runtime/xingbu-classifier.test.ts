import { describe, expect, it, vi } from 'vitest';

import { XingbuClassifier } from '../../src/runtime/xingbu-classifier';

describe('XingbuClassifier', () => {
  it('returns heuristic decisions when llm is not configured', async () => {
    const classifier = new XingbuClassifier({
      isConfigured: () => false
    } as any);

    await expect(
      classifier.classify({
        intent: 'read_file' as any,
        tool: { name: 'run_terminal', family: 'terminal' } as any,
        input: { command: 'wget https://a.sh >script.sh' }
      })
    ).resolves.toEqual({
      decision: 'deny',
      reason: '刑部判定该终端命令包含下载后直接执行/写入风险，已阻断。'
    });

    await expect(
      classifier.classify({
        intent: 'write_file' as any,
        tool: { name: 'run_terminal', family: 'terminal' } as any,
        input: { command: 'git push origin main' }
      })
    ).resolves.toEqual({
      decision: 'ask',
      reason: '刑部判定该终端命令涉及发布或外部侧效应，需要人工确认。'
    });

    await expect(
      classifier.classify({
        intent: 'read_file' as any,
        tool: { name: 'read_file', family: 'filesystem' } as any,
        input: { path: '.github/workflows/main.yml' }
      })
    ).resolves.toEqual({
      decision: 'ask',
      reason: '刑部判定目标路径影响依赖或 CI 配置，需要人工确认。'
    });

    await expect(
      classifier.classify({
        intent: 'read_file' as any,
        tool: { name: 'read_file', family: 'filesystem' } as any,
        input: { path: 'src/index.ts' }
      })
    ).resolves.toEqual({
      decision: 'allow',
      reason: '刑部判定该工作区文件操作风险可控，允许继续。'
    });

    await expect(
      classifier.classify({
        intent: 'write_file' as any,
        tool: { name: 'move_file', family: 'filesystem' } as any,
        input: { fromPath: 'docs/a.md', toPath: 'docs/b.md' }
      })
    ).resolves.toEqual({
      decision: 'allow',
      reason: '刑部判定该工作区文件操作风险可控，允许继续。'
    });

    await expect(
      classifier.classify({
        intent: 'call_external_api' as any,
        tool: { name: 'http_request', family: 'network' } as any,
        input: { method: 'DELETE' }
      })
    ).resolves.toEqual({
      decision: 'deny',
      reason: '刑部判定 DELETE 外部写请求风险过高，已阻断。'
    });

    await expect(
      classifier.classify({
        intent: 'call_external_api' as any,
        tool: { name: 'http_request', family: 'network' } as any,
        input: { method: 'POST' }
      })
    ).resolves.toEqual({
      decision: 'ask',
      reason: '刑部判定 POST 外部写请求仍需人工确认。'
    });

    await expect(
      classifier.classify({
        intent: 'call_external_api' as any,
        tool: { name: 'http_request', family: 'network' } as any,
        input: {}
      })
    ).resolves.toEqual({
      decision: 'ask',
      reason: '刑部判定 GET 外部写请求仍需人工确认。'
    });

    await expect(
      classifier.classify({
        intent: 'call_external_api' as any,
        tool: { name: 'mcp_call', family: 'mcp' } as any,
        input: {}
      })
    ).resolves.toEqual({
      decision: 'ask',
      reason: '刑部未能快速确认该边界动作安全性，建议人工确认。'
    });
  });

  it('uses llm classification when configured', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      decision: 'allow',
      reason: 'llm approved'
    });
    const classifier = new XingbuClassifier({
      isConfigured: () => true,
      generateObject
    } as any);

    await expect(
      classifier.classify({
        intent: 'read_file' as any,
        tool: { name: 'read_file', family: 'filesystem' } as any,
        input: { path: 'src/index.ts', currentMinistry: 'gongbu-code' }
      })
    ).resolves.toEqual({
      decision: 'allow',
      reason: 'llm approved'
    });

    expect(generateObject).toHaveBeenCalledWith(
      [
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('"name":"read_file"') })
      ],
      expect.anything(),
      {
        role: 'reviewer',
        taskId: 'xingbu_classifier:read_file',
        thinking: false,
        temperature: 0
      }
    );
  });

  it('falls back to heuristic classification when llm generation fails', async () => {
    const classifier = new XingbuClassifier({
      isConfigured: () => true,
      generateObject: vi.fn().mockRejectedValue(new Error('model unavailable'))
    } as any);

    await expect(
      classifier.classify({
        intent: 'read_file' as any,
        tool: { name: 'run_terminal', family: 'terminal' } as any,
        input: { command: 'echo hello' }
      })
    ).resolves.toEqual({
      decision: 'ask',
      reason: '刑部判定该终端命令存在边界风险，建议人工确认。'
    });
  });
});
