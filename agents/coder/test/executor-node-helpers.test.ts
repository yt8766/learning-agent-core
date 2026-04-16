import { describe, expect, it } from 'vitest';

import {
  buildToolInput,
  resolveWorkerToolAllowlist,
  selectIntent
} from '../src/flows/chat/nodes/executor-node-tooling';
import { buildActionPrompt, decorateExecutionSummary } from '../src/flows/chat/nodes/executor-node-skill';

type ExecutorContext = Parameters<typeof resolveWorkerToolAllowlist>[0];
type BuildActionPromptContext = Parameters<typeof buildActionPrompt>[0];
type RuntimeSkill = NonNullable<Parameters<typeof buildActionPrompt>[2]>;
type BuildToolInputContext = Parameters<typeof buildToolInput>[0];

describe('executor node helpers', () => {
  it('根据 worker capability 映射稳定工具白名单', () => {
    const allowlist = resolveWorkerToolAllowlist({
      currentWorker: {
        supportedCapabilities: ['knowledge-synthesis', 'refactor', 'browser']
      }
    } as unknown as ExecutorContext);

    expect(allowlist).toEqual(
      new Set([
        'list_directory',
        'local-analysis',
        'find-skills',
        'webSearchPrime',
        'webReader',
        'search_doc',
        'collect_research_source',
        'write_local_file',
        'browse_page'
      ])
    );
  });

  it('用技能步骤补强 action prompt 与总结文案', () => {
    const runtimeSkill: RuntimeSkill = {
      id: 'skill-1',
      name: '发布技能',
      steps: [{ title: '执行发布', instruction: '先跑构建再发布', toolNames: ['run_terminal'] }],
      constraints: ['不能直接改生产配置'],
      successSignals: ['ship-ready']
    };
    const prompt = buildActionPrompt(
      { goal: '发布版本' } as unknown as BuildActionPromptContext,
      '已完成研究',
      runtimeSkill,
      'run_terminal'
    );
    const summary = decorateExecutionSummary('执行完成', runtimeSkill);

    expect(prompt).toContain('已命中安装技能：发布技能');
    expect(prompt).toContain('技能步骤：执行发布，先跑构建再发布');
    expect(summary).toBe('[发布技能] 执行完成');
  });

  it('为 webSearchPrime 构造带 freshness hint 的工具输入', () => {
    const input = buildToolInput(
      {
        goal: '查看最新 React 发布',
        externalSources: []
      } as unknown as BuildToolInputContext,
      'webSearchPrime',
      '去查一下',
      '研究摘要'
    );

    expect(selectIntent('修复这个文件')).toBe('write_file');
    expect(input).toEqual(
      expect.objectContaining({
        freshnessHint: 'latest'
      })
    );
  });
});
