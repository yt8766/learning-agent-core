import { describe, expect, it } from 'vitest';

import { buildGongbuApprovalPreview } from '../src/flows/ministries/gongbu-code/gongbu-code-approval-gate';
import {
  buildGongbuToolInput,
  selectGongbuIntent,
  selectPreferredToolNameByWorkflow
} from '../src/flows/ministries/gongbu-code/gongbu-code-tool-resolution';
import {
  buildScaffoldWorkflowToolInput,
  parseScaffoldWorkflowCommand,
  resolveScaffoldToolName
} from '../src/flows/ministries/gongbu-code/gongbu-code-scaffold';
import { selectReadonlyBatchTools } from '../src/flows/ministries/gongbu-code/gongbu-code-readonly-batch';

type WorkflowContext = Parameters<typeof selectPreferredToolNameByWorkflow>[0];
type GongbuToolInputContext = Parameters<typeof buildGongbuToolInput>[0];
type ReadonlyTool = Parameters<typeof selectReadonlyBatchTools>[0];

describe('gongbu code ministry helpers', () => {
  it('根据目标语义判定写入型 intent', () => {
    expect(selectGongbuIntent('修复这个文件')).toBe('write_file');
    expect(selectGongbuIntent('删除旧目录')).toBe('delete_file');
    expect(selectGongbuIntent('定时提醒我复查')).toBe('schedule_task');
  });

  it('为浏览型 workflow 和搜索型工具构造稳定输入', () => {
    const toolName = selectPreferredToolNameByWorkflow({
      workflowPreset: { id: 'browse' },
      mcpClientManager: {
        hasCapability(name: string) {
          return name === 'webReader';
        }
      },
      toolRegistry: {
        get(name: string) {
          return name === 'webSearchPrime' ? { name } : undefined;
        }
      },
      externalSources: [{ sourceUrl: 'https://react.dev/blog', sourceType: 'web_research_plan' }]
    } as unknown as WorkflowContext);

    const input = buildGongbuToolInput(
      {
        goal: '查看最新 React 发布',
        externalSources: []
      } as unknown as GongbuToolInputContext,
      'webSearchPrime',
      '去查一下',
      '研究摘要'
    );

    expect(toolName).toBe('webReader');
    expect(input).toEqual(expect.objectContaining({ freshnessHint: 'latest' }));
  });

  it('为 scaffold workflow 解析显式子命令并生成稳定输入', () => {
    expect(
      parseScaffoldWorkflowCommand(
        'write --host-kind package --name demo-toolkit --template-id package-lib --target-root "packages/demo-toolkit" --force'
      )
    ).toEqual({
      action: 'write',
      hostKind: 'package',
      name: 'demo-toolkit',
      templateId: 'package-lib',
      targetRoot: 'packages/demo-toolkit',
      force: true
    });

    expect(resolveScaffoldToolName('preview --host-kind agent --name demo-reviewer')).toBe('preview_scaffold');
    expect(
      buildScaffoldWorkflowToolInput(
        'preview --host-kind package --name demo-toolkit --template-id package-lib --target-root packages/demo-toolkit'
      )
    ).toEqual({
      hostKind: 'package',
      name: 'demo-toolkit',
      templateId: 'package-lib',
      targetRoot: 'packages/demo-toolkit',
      force: false
    });
  });

  it('只读批量优先保留选中工具并补充流式只读候选', () => {
    const tools = selectReadonlyBatchTools(
      {
        name: 'read_local_file',
        isReadOnly: true,
        supportsStreamingDispatch: true
      } as ReadonlyTool,
      [
        { name: 'read_local_file', isReadOnly: true, supportsStreamingDispatch: true },
        { name: 'list_directory', isReadOnly: true, supportsStreamingDispatch: true },
        { name: 'search_in_files', isReadOnly: true, supportsStreamingDispatch: true },
        { name: 'write_local_file', isReadOnly: false, supportsStreamingDispatch: false }
      ] as ReadonlyTool[]
    );

    expect(tools.map(tool => tool.name)).toEqual(['read_local_file', 'list_directory', 'search_in_files']);
  });

  it('审批预览优先展示高价值字段', () => {
    expect(
      buildGongbuApprovalPreview('schedule_task', {
        command: 'pnpm test',
        path: 'src/index.ts',
        schedule: 'manual',
        actionPrompt: '执行测试'
      })
    ).toEqual([
      { label: 'Command', value: 'pnpm test' },
      { label: 'Path', value: 'src/index.ts' },
      { label: 'Schedule', value: 'manual' },
      { label: 'Action', value: '执行测试' }
    ]);
  });
});
