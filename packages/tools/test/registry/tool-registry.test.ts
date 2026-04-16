import { describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { createDefaultToolRegistry, ToolRegistry } from '../../src/registry/tool-registry';

describe('ToolRegistry', () => {
  it('groups tools by stable families', () => {
    const registry = createDefaultToolRegistry();
    const filesystem = registry.listByFamily('filesystem').map(tool => tool.name);
    const scaffold = registry.listByFamily('scaffold').map(tool => tool.name);

    expect(filesystem).toEqual(
      expect.arrayContaining(['read_local_file', 'write_local_file', 'patch_local_file', 'search_in_files'])
    );
    expect(scaffold).toEqual(expect.arrayContaining(['list_scaffold_templates', 'preview_scaffold', 'write_scaffold']));
    expect(registry.getFamily('filesystem')).toEqual(
      expect.objectContaining({
        id: 'filesystem',
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
    expect(registry.getFamily('scaffold')).toEqual(
      expect.objectContaining({
        id: 'scaffold',
        preferredMinistries: expect.arrayContaining(['libu-governance', 'gongbu-code', 'libu-delivery'])
      })
    );
  });

  it('keeps intent routing on the new registry boundary', () => {
    const registry = createDefaultToolRegistry();

    expect(registry.getForIntent(ActionIntent.WRITE_FILE)?.name).toBe('write_local_file');
    expect(registry.getForIntent(ActionIntent.DELETE_FILE)?.name).toBe('delete_local_file');
    expect(registry.getForIntent(ActionIntent.SCHEDULE_TASK)?.family).toBe('scheduling');
  });

  it('exposes explicit concurrency and permission semantics for registered tools', () => {
    const registry = createDefaultToolRegistry();

    expect(registry.get('read_local_file')).toEqual(
      expect.objectContaining({
        isReadOnly: true,
        isConcurrencySafe: true,
        supportsStreamingDispatch: true,
        permissionScope: 'readonly'
      })
    );
    expect(registry.get('write_local_file')).toEqual(
      expect.objectContaining({
        isReadOnly: false,
        isConcurrencySafe: false,
        supportsStreamingDispatch: false,
        permissionScope: 'workspace-write'
      })
    );
    expect(registry.get('generate_data_report_scaffold')).toEqual(
      expect.objectContaining({
        isReadOnly: true,
        requiresApproval: false,
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
    expect(registry.get('plan_data_report_structure')).toEqual(
      expect.objectContaining({
        isReadOnly: true,
        requiresApproval: false,
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
    expect(registry.get('generate_data_report_module')).toEqual(
      expect.objectContaining({
        isReadOnly: true,
        requiresApproval: false,
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
    expect(registry.get('assemble_data_report_bundle')).toEqual(
      expect.objectContaining({
        isReadOnly: true,
        requiresApproval: false,
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
    expect(registry.get('generate_data_report_routes')).toEqual(
      expect.objectContaining({
        isReadOnly: true,
        requiresApproval: false,
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
    expect(registry.get('write_data_report_bundle')).toEqual(
      expect.objectContaining({
        isReadOnly: false,
        requiresApproval: true,
        permissionScope: 'workspace-write',
        preferredMinistries: expect.arrayContaining(['gongbu-code'])
      })
    );
    expect(registry.get('list_scaffold_templates')).toEqual(
      expect.objectContaining({
        family: 'scaffold',
        isReadOnly: true,
        requiresApproval: false,
        permissionScope: 'readonly'
      })
    );
    expect(registry.get('preview_scaffold')).toEqual(
      expect.objectContaining({
        family: 'scaffold',
        isReadOnly: true,
        requiresApproval: false,
        permissionScope: 'readonly'
      })
    );
    expect(registry.get('write_scaffold')).toEqual(
      expect.objectContaining({
        family: 'scaffold',
        isReadOnly: false,
        requiresApproval: true,
        sandboxProfile: 'workspace-write',
        permissionScope: 'workspace-write',
        preferredMinistries: expect.arrayContaining(['libu-governance', 'gongbu-code', 'libu-delivery'])
      })
    );
  });

  it('rejects tools missing required semantic fields', () => {
    expect(
      () =>
        new ToolRegistry(
          [
            {
              name: 'unsafe_tool',
              description: 'unsafe',
              family: 'filesystem',
              category: 'action',
              riskLevel: 'high',
              requiresApproval: true,
              timeoutMs: 1000,
              sandboxProfile: 'workspace-write',
              capabilityType: 'local-tool',
              inputSchema: {}
            } as any
          ],
          createDefaultToolRegistry().listFamilies()
        )
    ).toThrow(/missing required semantic field/);
  });
});
