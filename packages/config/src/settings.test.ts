import { afterEach, describe, expect, it } from 'vitest';

import { loadSettings } from './settings';

const ORIGINAL_CWD = process.cwd();

describe('loadSettings', () => {
  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
  });

  it('从后端目录启动时仍然把数据路径解析到仓库根级 data 目录', () => {
    process.chdir('D:/渡一资料/Agent/apps/backend/agent-server');

    const settings = loadSettings({ PORT: '3000' } as NodeJS.ProcessEnv);

    expect(settings.workspaceRoot.replace(/\\/g, '/')).toBe('D:/渡一资料/Agent');
    expect(settings.tasksStateFilePath.replace(/\\/g, '/')).toBe('D:/渡一资料/Agent/data/runtime/tasks-state.json');
    expect(settings.memoryFilePath.replace(/\\/g, '/')).toBe('D:/渡一资料/Agent/data/memory/records.jsonl');
    expect(settings.skillsRoot.replace(/\\/g, '/')).toBe('D:/渡一资料/Agent/data/skills');
  });

  it('保留显式传入的绝对路径配置', () => {
    const settings = loadSettings({
      PORT: '3001',
      TASKS_STATE_FILE_PATH: 'D:/custom/runtime/tasks.json',
      MEMORY_FILE_PATH: 'D:/custom/memory/records.jsonl'
    } as NodeJS.ProcessEnv);

    expect(settings.port).toBe(3001);
    expect(settings.tasksStateFilePath.replace(/\\/g, '/')).toBe('D:/custom/runtime/tasks.json');
    expect(settings.memoryFilePath.replace(/\\/g, '/')).toBe('D:/custom/memory/records.jsonl');
  });
});
