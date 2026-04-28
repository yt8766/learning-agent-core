import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillArtifactFetcher } from '../src/install/skill-artifact-fetcher';

describe('SkillArtifactFetcher', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'skill-artifact-fetcher-'));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes manifest-only fallback when no artifact target is provided', async () => {
    const fetcher = new SkillArtifactFetcher(workspaceRoot);

    const result = await fetcher.fetchToStaging(
      {
        id: 'skill-a',
        sourceId: 'source-a',
        name: 'Skill A',
        description: 'desc',
        summary: 'summary',
        version: '1.0.0',
        riskLevel: 'low',
        approvalPolicy: 'auto'
      } as never,
      {
        id: 'source-a',
        kind: 'internal',
        enabled: true
      } as never,
      'receipt-a'
    );

    expect(result.integrityVerified).toBe(false);
    expect(result.metadata).toEqual({ mode: 'manifest-only' });
    expect(result.artifactPath).toContain('manifest.json');
    await expect(readFile(result.artifactPath!, 'utf8')).resolves.toContain('"id": "skill-a"');
  });

  it('downloads remote artifacts and reports http failures', async () => {
    const fetcher = new SkillArtifactFetcher(workspaceRoot);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503
      });
    vi.stubGlobal('fetch', fetchMock);

    const downloaded = await fetcher.fetchToStaging(
      {
        id: 'skill-b',
        sourceId: 'source-b',
        name: 'Skill B',
        description: 'desc',
        summary: 'summary',
        version: '1.0.0',
        artifactUrl: 'https://example.com/artifacts/skill-b.tgz',
        integrity: 'sha256-abc',
        riskLevel: 'low',
        approvalPolicy: 'manual'
      } as never,
      {
        id: 'source-b',
        kind: 'marketplace',
        enabled: true
      } as never,
      'receipt-b'
    );

    expect(downloaded).toEqual(
      expect.objectContaining({
        integrityVerified: true,
        bytes: 4,
        metadata: { mode: 'remote-download', filename: 'skill-b.tgz' }
      })
    );
    await expect(stat(downloaded.artifactPath!)).resolves.toEqual(expect.objectContaining({ size: 4 }));

    await expect(
      fetcher.fetchToStaging(
        {
          id: 'skill-b',
          sourceId: 'source-b',
          name: 'Skill B',
          description: 'desc',
          summary: 'summary',
          version: '1.0.0',
          artifactUrl: 'https://example.com/artifacts/fail.zip',
          riskLevel: 'low',
          approvalPolicy: 'manual'
        } as never,
        {
          id: 'source-b',
          kind: 'marketplace',
          enabled: true
        } as never,
        'receipt-b-fail'
      )
    ).rejects.toThrow('artifact_fetch_http_503');
  });

  it('copies local files, preserves json content, handles directories, and promotes staging', async () => {
    const jsonPath = join(workspaceRoot, 'skills', 'skill.json');
    const dirPath = join(workspaceRoot, 'skills', 'bundle');
    await mkdir(join(workspaceRoot, 'skills'), { recursive: true });
    await mkdir(dirPath, { recursive: true });
    await writeFile(jsonPath, '{\n  "hello": true\n}\n');
    await writeFile(join(dirPath, 'index.js'), 'export const ok = true;\n');

    const fetcher = new SkillArtifactFetcher(workspaceRoot);

    const jsonResult = await fetcher.fetchToStaging(
      {
        id: 'skill-json',
        sourceId: 'source-local',
        name: 'Skill JSON',
        description: 'desc',
        summary: 'summary',
        version: '1.0.0',
        entry: 'skills/skill.json',
        integrity: 'sha256-local',
        riskLevel: 'low',
        approvalPolicy: 'manual'
      } as never,
      {
        id: 'source-local',
        kind: 'internal',
        enabled: true
      } as never,
      'receipt-json'
    );

    expect(jsonResult).toEqual(
      expect.objectContaining({
        bytes: expect.any(Number),
        integrityVerified: true,
        metadata: { mode: 'file-copy', filename: 'skill.json' }
      })
    );
    await expect(readFile(jsonResult.artifactPath!, 'utf8')).resolves.toBe('{\n  "hello": true\n}\n');

    const dirResult = await fetcher.fetchToStaging(
      {
        id: 'skill-dir',
        sourceId: 'source-local',
        name: 'Skill Dir',
        description: 'desc',
        summary: 'summary',
        version: '1.0.0',
        entry: dirPath,
        riskLevel: 'low',
        approvalPolicy: 'manual'
      } as never,
      {
        id: 'source-local',
        kind: 'internal',
        enabled: true
      } as never,
      'receipt-dir'
    );

    expect(dirResult).toEqual(
      expect.objectContaining({
        integrityVerified: false,
        metadata: { mode: 'directory-copy' }
      })
    );
    await expect(readFile(join(dirResult.artifactPath!, 'index.js'), 'utf8')).resolves.toContain('ok = true');

    const installDir = join(workspaceRoot, 'data', 'skills', 'installed', 'skill-dir');
    await fetcher.promoteFromStaging(dirResult.stagingDir, installDir);
    await expect(readFile(join(installDir, 'bundle', 'index.js'), 'utf8')).resolves.toContain('ok = true');
  });

  it('materializes active workspace draft entries into skill markdown artifacts', async () => {
    await mkdir(join(workspaceRoot, 'data', 'skills', 'drafts'), { recursive: true });
    await writeFile(
      join(workspaceRoot, 'data', 'skills', 'drafts', 'workspace-drafts.json'),
      JSON.stringify(
        [
          {
            id: 'draft-browser-evidence',
            workspaceId: 'workspace-platform',
            title: 'Reuse browser evidence',
            description: 'Capture repeated browser evidence collection.',
            triggerHints: ['browser evidence'],
            bodyMarkdown: '# Reuse browser evidence\n\nOpen the evidence source and cite it.',
            requiredTools: ['browser.open'],
            requiredConnectors: ['browser-mcp'],
            sourceTaskId: 'task-1',
            source: 'workspace-vault',
            riskLevel: 'medium',
            confidence: 0.82,
            sourceEvidenceIds: ['evidence-1'],
            status: 'active',
            reuseStats: { count: 0 },
            approvedBy: 'reviewer-1',
            approvedAt: '2026-04-26T01:02:03.000Z',
            createdAt: '2026-04-26T01:00:00.000Z',
            updatedAt: '2026-04-26T01:02:03.000Z'
          }
        ],
        null,
        2
      )
    );

    const fetcher = new SkillArtifactFetcher(workspaceRoot);
    const result = await fetcher.fetchToStaging(
      {
        id: 'workspace-draft-draft-browser-evidence',
        sourceId: 'workspace-skill-drafts',
        name: 'Reuse browser evidence',
        description: 'Capture repeated browser evidence collection.',
        version: '20260426010203',
        entry: 'workspace-draft:draft-browser-evidence',
        riskLevel: 'medium',
        approvalPolicy: 'high-risk-only',
        requiredCapabilities: ['browser.open'],
        requiredConnectors: ['browser-mcp'],
        allowedTools: ['browser.open']
      } as any,
      {
        id: 'workspace-skill-drafts',
        kind: 'internal',
        enabled: true
      } as any,
      'receipt-workspace-draft'
    );

    expect(result).toEqual(
      expect.objectContaining({
        integrityVerified: true,
        metadata: {
          mode: 'workspace-draft',
          draftId: 'draft-browser-evidence'
        }
      })
    );
    await expect(readFile(join(result.stagingDir, 'SKILL.md'), 'utf8')).resolves.toContain('Open the evidence source');
    await expect(readFile(join(result.stagingDir, 'manifest.json'), 'utf8')).resolves.toContain(
      'workspace-draft-draft-browser-evidence'
    );
  });
});
