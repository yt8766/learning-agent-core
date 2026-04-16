import { describe, expect, it } from 'vitest';

import {
  buildProfilePatchFromPreferenceUpdate,
  inferPreferenceField
} from '../src/pages/chat-home/chat-memory-preference-helpers';

describe('chat memory preference helpers', () => {
  it('infers profile field from preference memory tags and summary', () => {
    const source = {
      id: 'source-1',
      taskId: 'task-1',
      sourceType: 'memory_reuse',
      trustClass: 'internal',
      summary: '已命中历史记忆：用户偏好先给结论再解释。',
      detail: {
        memoryId: 'memory-1',
        memoryType: 'preference',
        tags: ['user-style', 'communication']
      },
      createdAt: '2026-04-16T00:00:00.000Z'
    } as const;

    expect(inferPreferenceField(source as never)).toBe('communicationStyle');
    expect(buildProfilePatchFromPreferenceUpdate(source as never, '先给结论，再补解释')).toEqual({
      communicationStyle: '先给结论，再补解释'
    });
  });

  it('supports explicit field syntax for profile patching', () => {
    const source = {
      id: 'source-2',
      taskId: 'task-2',
      sourceType: 'memory_reuse',
      trustClass: 'internal',
      summary: '已命中历史记忆：用户偏好代码实现前先跑测试。',
      detail: {
        memoryId: 'memory-2',
        memoryType: 'preference',
        tags: ['workflow']
      },
      createdAt: '2026-04-16T00:00:00.000Z'
    } as const;

    expect(buildProfilePatchFromPreferenceUpdate(source as never, 'doNotDo: 不要默认自动提交, 不要跳过测试')).toEqual({
      doNotDo: ['不要默认自动提交', '不要跳过测试']
    });
  });
});
