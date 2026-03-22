import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSettings } from './settings';

/** 与 settings.findWorkspaceRoot 一致：从启动时的 cwd 向上找 pnpm-workspace.yaml（避免硬编码盘符与目录名） */
function resolveMonorepoRootFromCwd(): string {
  let current = resolve(process.cwd());
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('无法定位 monorepo 根：从 process.cwd() 向上未找到 pnpm-workspace.yaml');
    }
    current = parent;
  }
}

const REPO_ROOT = resolveMonorepoRootFromCwd();
const BACKEND_AGENT_SERVER_CWD = join(REPO_ROOT, 'apps', 'backend', 'agent-server');

const ORIGINAL_CWD = process.cwd();

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('loadSettings', () => {
  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
  });

  it('从后端目录启动时仍然把数据路径解析到仓库根级 data 目录', () => {
    process.chdir(BACKEND_AGENT_SERVER_CWD);

    const settings = loadSettings({ PORT: '3000' } as NodeJS.ProcessEnv);

    expect(toPosixPath(settings.workspaceRoot)).toBe(toPosixPath(REPO_ROOT));
    expect(toPosixPath(settings.tasksStateFilePath)).toBe(
      toPosixPath(join(REPO_ROOT, 'data', 'runtime', 'tasks-state.json'))
    );
    expect(toPosixPath(settings.memoryFilePath)).toBe(toPosixPath(join(REPO_ROOT, 'data', 'memory', 'records.jsonl')));
    expect(toPosixPath(settings.skillsRoot)).toBe(toPosixPath(join(REPO_ROOT, 'data', 'skills')));
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
