import { describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { createDefaultToolRegistry } from '../../src/registry/tool-registry';

describe('ToolRegistry', () => {
  it('groups tools by stable families', () => {
    const registry = createDefaultToolRegistry();
    const filesystem = registry.listByFamily('filesystem').map(tool => tool.name);

    expect(filesystem).toEqual(
      expect.arrayContaining(['read_local_file', 'write_local_file', 'patch_local_file', 'search_in_files'])
    );
    expect(registry.getFamily('filesystem')).toEqual(
      expect.objectContaining({
        id: 'filesystem',
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
  });

  it('keeps intent routing on the new registry boundary', () => {
    const registry = createDefaultToolRegistry();

    expect(registry.getForIntent(ActionIntent.WRITE_FILE)?.name).toBe('write_local_file');
    expect(registry.getForIntent(ActionIntent.DELETE_FILE)?.name).toBe('delete_local_file');
    expect(registry.getForIntent(ActionIntent.SCHEDULE_TASK)?.family).toBe('scheduling');
  });
});
