import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MigrationPage, createMigrationApplyRequest } from '../src/app/pages/MigrationPage';

describe('MigrationPage', () => {
  it('renders CLIProxyAPI preview resources and conflicts', () => {
    const html = renderToStaticMarkup(
      <MigrationPage
        initialApiBase="https://router.example.com"
        initialManagementKey="mgmt-secret"
        initialPreview={{
          source: {
            apiBase: 'https://router.example.com',
            serverVersion: 'cli-proxy-1.2.3',
            checkedAt: '2026-05-11T00:00:00.000Z'
          },
          resources: [
            {
              kind: 'providerConfig',
              sourceId: 'codex',
              targetId: 'codex',
              action: 'create',
              safe: true,
              summary: 'Codex Production'
            },
            {
              kind: 'apiKey',
              sourceId: 'proxy-key-1',
              targetId: null,
              action: 'conflict',
              safe: false,
              summary: 'Production proxy key'
            }
          ],
          conflicts: [
            {
              kind: 'apiKey',
              sourceId: 'proxy-key-1',
              targetId: 'cli-proxy-import',
              reason: 'Only masked API key metadata is available',
              resolution: 'manual'
            }
          ],
          totals: { create: 1, update: 0, skip: 0, conflict: 1 }
        }}
      />
    );

    expect(html).toContain('CLIProxyAPI 迁移');
    expect(html).toContain('Codex Production');
    expect(html).toContain('Production proxy key');
    expect(html).toContain('Only masked API key metadata is available');
    expect(html).toContain('Conflict 1');
  });

  it('builds apply requests with safe resources by default and unsafe conflicts only after confirmation', () => {
    expect(
      createMigrationApplyRequest(
        'https://router.example.com',
        'mgmt-secret',
        ['codex'],
        new Set(['codex', 'proxy-key-1']),
        false
      )
    ).toEqual({
      apiBase: 'https://router.example.com',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['codex'],
      confirmUnsafeConflicts: false
    });

    expect(
      createMigrationApplyRequest(
        'https://router.example.com',
        'mgmt-secret',
        ['codex'],
        new Set(['codex', 'proxy-key-1']),
        true
      )
    ).toEqual({
      apiBase: 'https://router.example.com',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['codex', 'proxy-key-1'],
      confirmUnsafeConflicts: true
    });
  });

  it('renders apply report warnings and failure reasons without secret fields', () => {
    const rendered = renderToStaticMarkup(
      <MigrationPage
        initialApiBase="https://router.example.com"
        initialApplyResult={{
          migrationId: 'cli-proxy-123',
          appliedAt: '2026-05-11T00:00:00.000Z',
          imported: [{ kind: 'providerConfig', sourceId: 'codex', targetId: 'codex' }],
          skipped: [{ kind: 'apiKey', sourceId: 'proxy-key-1', targetId: 'cli-proxy-import' }],
          failed: [{ kind: 'quota', sourceId: 'codex-quota', reason: 'repository unavailable' }],
          warnings: ['apiKey:proxy-key-1 skipped because unsafe conflict requires confirmation']
        }}
      />
    );

    expect(rendered).toContain('Imported 1 / Skipped 1 / Failed 1');
    expect(rendered).toContain('Warnings 1');
    expect(rendered).toContain('repository unavailable');
    expect(rendered).toContain('unsafe conflict requires confirmation');
    expect(rendered).not.toContain('mgmt-secret');
  });
});
