import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySkillInstallRepository, SkillArtifactFetcher, type SkillInstallRepository } from '@agent/skill';

const {
  buildSkillsAddCommandMock,
  buildSkillsAddCommandPlanMock,
  buildSkillsCheckCommandPlanMock,
  buildSkillsUpdateCommandPlanMock,
  execSkillsCommandMock
} = vi.hoisted(() => ({
  buildSkillsAddCommandMock: vi.fn(() => 'npx skills add mocked'),
  buildSkillsAddCommandPlanMock: vi.fn(() => ({ command: 'npx' as const, args: ['skills', 'add', 'mocked'] })),
  buildSkillsCheckCommandPlanMock: vi.fn(() => ({ command: 'npx' as const, args: ['skills', 'check'] })),
  buildSkillsUpdateCommandPlanMock: vi.fn(() => ({ command: 'npx' as const, args: ['skills', 'update'] })),
  execSkillsCommandMock: vi.fn(async plan => ({ stdout: plan.args.join(' '), stderr: '' }))
}));

vi.mock('../../../src/runtime/skills/runtime-skill-cli', () => ({
  buildSkillsAddCommand: buildSkillsAddCommandMock,
  buildSkillsAddCommandPlan: buildSkillsAddCommandPlanMock,
  buildSkillsCheckCommandPlan: buildSkillsCheckCommandPlanMock,
  buildSkillsUpdateCommandPlan: buildSkillsUpdateCommandPlanMock,
  execSkillsCommand: execSkillsCommandMock
}));

import {
  autoInstallLocalManifest,
  checkInstalledSkills,
  finalizeRemoteSkillInstall,
  finalizeSkillInstall,
  getSkillInstallReceipt,
  readInstalledSkillRecords,
  readSkillInstallReceipts,
  updateInstalledSkills,
  writeInstalledSkillRecord,
  writeSkillInstallReceipt,
  type RuntimeSkillInstallContext
} from '../../../src/runtime/skills/runtime-skill-install.service';

function createContext(
  root: string,
  overrides: { skillInstallRepository?: SkillInstallRepository } = {}
): RuntimeSkillInstallContext & any {
  const publishToLab = vi.fn(async skill => ({ ...skill, published: true }));
  const registerInstalledSkillWorker = vi.fn();
  const fetchToStaging = vi.fn(async (_manifest, _source, receiptId) => ({
    stagingDir: join(root, 'staging', receiptId),
    artifactPath: join(root, 'staging', receiptId, 'artifact.json'),
    integrityVerified: true
  }));
  const promoteFromStaging = vi.fn(async () => undefined);
  const install = vi.fn(async () => ({ stdout: 'installed', stderr: '' }));
  const check = vi.fn(async () => ({ stdout: 'checked', stderr: '' }));
  const update = vi.fn(async () => ({ stdout: 'updated', stderr: '' }));

  return {
    settings: {
      workspaceRoot: root,
      skillReceiptsRoot: join(root, 'receipts'),
      skillPackagesRoot: join(root, 'packages')
    },
    skillRegistry: { publishToLab },
    skillArtifactFetcher: { fetchToStaging, promoteFromStaging },
    listSkillSources: vi.fn(async () => []),
    registerInstalledSkillWorker,
    remoteSkillCli: { install, check, update },
    skillInstallRepository: overrides.skillInstallRepository,
    publishToLab,
    fetchToStaging,
    promoteFromStaging,
    install
  };
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'receipt-1',
    skillId: 'skill-a',
    version: '1.0.0',
    sourceId: 'source-a',
    status: 'approved',
    phase: 'approved',
    result: 'ready',
    ...overrides
  } as any;
}

const installedRecord = (overrides: Record<string, unknown> = {}) => ({
  skillId: 'skill-a',
  version: '1.0.0',
  sourceId: 'source-a',
  installLocation: '/tmp/one',
  installedAt: '2026-04-02T00:00:00.000Z',
  status: 'installed',
  receiptId: 'receipt-1',
  ...overrides
});

const localManifest = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'skill-local',
    sourceId: 'source-local',
    name: 'Skill Local',
    description: 'desc',
    summary: 'summary',
    version: '1.0.0',
    approvalPolicy: 'manual',
    riskLevel: 'low',
    allowedTools: ['terminal'],
    requiredCapabilities: ['shell'],
    requiredConnectors: ['github'],
    compatibility: '>=1.0.0',
    ...overrides
  }) as any;

const remoteReceipt = (overrides: Record<string, unknown> = {}) =>
  receipt({
    id: 'receipt-remote',
    skillId: 'remote-skill',
    version: undefined,
    sourceId: 'source-remote',
    repo: 'owner/repo',
    ...overrides
  });

async function expectNoRootInstallJson(root: string) {
  await expect(access(join(root, 'receipts', 'receipts.json'))).rejects.toThrow();
  await expect(access(join(root, 'packages', 'installed.json'))).rejects.toThrow();
}

describe('runtime-skill-install.service', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-skill-install-'));
    vi.restoreAllMocks();
    buildSkillsAddCommandMock.mockReturnValue('npx skills add mocked');
    buildSkillsAddCommandPlanMock.mockReturnValue({ command: 'npx', args: ['skills', 'add', 'mocked'] });
    buildSkillsCheckCommandPlanMock.mockReturnValue({ command: 'npx', args: ['skills', 'check'] });
    buildSkillsUpdateCommandPlanMock.mockReturnValue({ command: 'npx', args: ['skills', 'update'] });
    execSkillsCommandMock.mockResolvedValue({ stdout: 'ok', stderr: '' });
  });

  it('reads and writes receipts and installed skill records with dedupe', async () => {
    const context = createContext(workspaceRoot);

    await writeSkillInstallReceipt(context, receipt());
    await writeSkillInstallReceipt(
      context,
      receipt({ version: '1.0.1', status: 'installed', phase: 'installed', result: 'done' })
    );

    expect(await readSkillInstallReceipts(context)).toEqual([
      expect.objectContaining({
        id: 'receipt-1',
        version: '1.0.1',
        status: 'installed'
      })
    ]);
    await expect(getSkillInstallReceipt(context, 'missing')).rejects.toThrow('not found');

    await writeInstalledSkillRecord(context, installedRecord());
    await writeInstalledSkillRecord(
      context,
      installedRecord({ installLocation: '/tmp/two', installedAt: '2026-04-02T00:00:01.000Z' })
    );

    expect(await readInstalledSkillRecords(context)).toEqual([
      expect.objectContaining({
        skillId: 'skill-a',
        installLocation: '/tmp/two'
      })
    ]);
  });

  it('uses injected repository for receipts and installed records without root data json files', async () => {
    const repository = new MemorySkillInstallRepository();
    const context = createContext(workspaceRoot, { skillInstallRepository: repository });

    await writeSkillInstallReceipt(
      context,
      receipt({ id: 'receipt-repo', skillId: 'skill-repo', sourceId: 'source-repo' })
    );
    await writeInstalledSkillRecord(
      context,
      installedRecord({
        skillId: 'skill-repo',
        sourceId: 'source-repo',
        installLocation: '/repo/install',
        receiptId: 'receipt-repo'
      })
    );

    expect(await getSkillInstallReceipt(context, 'receipt-repo')).toEqual(
      expect.objectContaining({ id: 'receipt-repo' })
    );
    expect(await readSkillInstallReceipts(context)).toEqual([expect.objectContaining({ id: 'receipt-repo' })]);
    expect(await readInstalledSkillRecords(context)).toEqual([
      expect.objectContaining({ skillId: 'skill-repo', installLocation: '/repo/install' })
    ]);
    await expectNoRootInstallJson(workspaceRoot);
  });

  it('guards auto install by enabled source and finalizes local installs', async () => {
    const context = createContext(workspaceRoot, { skillInstallRepository: new MemorySkillInstallRepository() });
    const manifest = localManifest();

    context.listSkillSources = vi.fn(async () => [{ id: 'source-local', kind: 'internal', enabled: false } as any]);
    await expect(autoInstallLocalManifest(context, manifest)).resolves.toBeUndefined();

    context.listSkillSources = vi.fn(async () => [{ id: 'source-local', kind: 'internal', enabled: true } as any]);
    const installed = await autoInstallLocalManifest(context, manifest);

    expect(installed).toEqual(
      expect.objectContaining({
        skillId: 'skill-local',
        version: '1.0.0',
        status: 'installed'
      })
    );
    expect(context.fetchToStaging).toHaveBeenCalledWith(
      manifest,
      expect.objectContaining({ id: 'source-local' }),
      expect.any(String)
    );
    expect(context.promoteFromStaging).toHaveBeenCalledWith(
      expect.stringContaining('staging'),
      expect.stringContaining('/packages/internal/skill-local/1.0.0')
    );
    expect(context.publishToLab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'skill-local',
        constraints: expect.arrayContaining(['source=source-local', 'approvalPolicy=manual', 'connector=github'])
      })
    );
    expect(context.registerInstalledSkillWorker).toHaveBeenCalledWith(expect.objectContaining({ id: 'skill-local' }));

    const receipts = await readSkillInstallReceipts(context);
    expect(receipts.at(-1)).toEqual(expect.objectContaining({ status: 'installed', result: 'installed_to_lab' }));
    await expectNoRootInstallJson(workspaceRoot);
    await expect(
      readFile(join(workspaceRoot, 'packages', 'internal', 'skill-local', '1.0.0', 'skill-local@1.0.0.json'), 'utf8')
    ).resolves.toContain('"skill-local"');
  });

  it('finalizes workspace draft manifests through the real artifact fetcher', async () => {
    const context = createContext(workspaceRoot);
    context.skillArtifactFetcher = new SkillArtifactFetcher(workspaceRoot);
    const draftsRoot = join(workspaceRoot, 'data', 'skills', 'drafts');
    await mkdir(draftsRoot, { recursive: true });
    await writeFile(
      join(draftsRoot, 'workspace-drafts.json'),
      JSON.stringify([
        {
          id: 'draft-browser-evidence',
          workspaceId: 'workspace-platform',
          title: 'Reuse browser evidence',
          description: 'Capture repeated browser evidence collection.',
          bodyMarkdown: '# Reuse browser evidence\n\nOpen the evidence source and cite it.',
          requiredTools: ['browser.open'],
          requiredConnectors: ['browser-mcp'],
          source: 'workspace-vault',
          riskLevel: 'medium',
          confidence: 0.82,
          status: 'active',
          approvedBy: 'reviewer-1',
          approvedAt: '2026-04-26T01:02:03.000Z',
          createdAt: '2026-04-26T01:00:00.000Z',
          updatedAt: '2026-04-26T01:02:03.000Z'
        }
      ])
    );

    const manifest = localManifest({
      id: 'workspace-draft-draft-browser-evidence',
      name: 'Reuse browser evidence',
      description: 'Capture repeated browser evidence collection.',
      summary: 'Capture repeated browser evidence collection.',
      version: '20260426010203',
      entry: 'workspace-draft:draft-browser-evidence',
      approvalPolicy: 'high-risk-only',
      riskLevel: 'medium',
      allowedTools: ['browser.open'],
      requiredCapabilities: ['browser.open'],
      requiredConnectors: ['browser-mcp']
    });
    const source = { id: 'workspace-skill-drafts', kind: 'internal', enabled: true } as any;
    const draftReceipt = receipt({
      id: 'receipt-workspace-draft',
      skillId: manifest.id,
      version: manifest.version,
      sourceId: source.id
    });

    const installed = await finalizeSkillInstall(context, manifest, source, draftReceipt);

    expect(installed).toEqual(
      expect.objectContaining({ skillId: manifest.id, sourceId: source.id, status: 'installed' })
    );
    const installDir = join(workspaceRoot, 'packages', 'internal', manifest.id, manifest.version);
    await expect(readFile(join(installDir, 'SKILL.md'), 'utf8')).resolves.toContain('Open the evidence source');
    expect(context.publishToLab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'workspace-draft-draft-browser-evidence',
        installReceiptId: 'receipt-workspace-draft'
      })
    );
  });

  it('records failed local installs and cleans staging when artifact fetching throws', async () => {
    const context = createContext(workspaceRoot);
    context.fetchToStaging.mockRejectedValueOnce(new Error('artifact_broken'));
    const failedReceipt = receipt({ id: 'receipt-failed', skillId: 'skill-failed', sourceId: 'source-local' });

    await expect(
      finalizeSkillInstall(
        context,
        localManifest({ id: 'skill-failed', sourceId: 'source-local', name: 'Skill Failed' }),
        { id: 'source-local', kind: 'marketplace', enabled: true } as any,
        failedReceipt
      )
    ).rejects.toThrow('artifact_broken');

    expect(await getSkillInstallReceipt(context, 'receipt-failed')).toEqual(
      expect.objectContaining({
        status: 'failed',
        phase: 'failed',
        failureCode: 'artifact_broken',
        result: 'install_failed'
      })
    );
  });

  it('finalizes remote installs, validates missing repo, and delegates check/update', async () => {
    const context = createContext(workspaceRoot, { skillInstallRepository: new MemorySkillInstallRepository() });
    const approvedReceipt = remoteReceipt({
      repo: 'owner/repo with spaces',
      skillName: 'skill/name',
      reason: 'capability gap'
    });

    const installed = await finalizeRemoteSkillInstall(context, approvedReceipt);
    expect(installed).toEqual(
      expect.objectContaining({
        skillId: 'remote-skill',
        version: 'remote',
        installLocation: expect.stringContaining('owner-repo-with-spaces/skill-name/remote')
      })
    );
    expect(context.install).toHaveBeenCalledWith({ repo: 'owner/repo with spaces', skillName: 'skill/name' });
    expect(context.registerInstalledSkillWorker).toHaveBeenCalledWith(expect.objectContaining({ id: 'remote-skill' }));
    await expectNoRootInstallJson(workspaceRoot);
    await expect(
      readFile(
        join(
          workspaceRoot,
          'packages',
          'third-party',
          'owner-repo-with-spaces',
          'skill-name',
          'remote',
          'remote-skill.json'
        ),
        'utf8'
      )
    ).resolves.toContain('capability gap');

    await expect(
      finalizeRemoteSkillInstall(context, { id: 'bad-receipt', skillId: 'bad', sourceId: 'x' } as any)
    ).rejects.toThrow('missing repo');

    await expect(checkInstalledSkills(context)).resolves.toEqual({ stdout: 'checked', stderr: '' });
    await expect(updateInstalledSkills(context)).resolves.toEqual({ stdout: 'updated', stderr: '' });
  });

  it('records failed remote installs and falls back to default cli delegates', async () => {
    const context = createContext(workspaceRoot);
    context.install.mockRejectedValueOnce(new Error('remote_cli_failed'));

    await expect(
      finalizeRemoteSkillInstall(context, remoteReceipt({ id: 'receipt-remote-failed', skillId: 'remote-failed' }))
    ).rejects.toThrow('remote_cli_failed');
    expect(await getSkillInstallReceipt(context, 'receipt-remote-failed')).toEqual(
      expect.objectContaining({
        status: 'failed',
        phase: 'failed',
        failureCode: 'remote_cli_failed',
        result: 'install_failed'
      })
    );

    const fallbackContext = {
      ...context,
      remoteSkillCli: undefined
    } as any;

    await expect(checkInstalledSkills(fallbackContext)).resolves.toEqual({ stdout: 'ok', stderr: '' });
    await expect(updateInstalledSkills(fallbackContext)).resolves.toEqual({ stdout: 'ok', stderr: '' });
    await expect(
      finalizeRemoteSkillInstall(
        fallbackContext,
        remoteReceipt({ id: 'receipt-default-cli', skillId: 'remote-default' })
      )
    ).resolves.toEqual(expect.objectContaining({ skillId: 'remote-default' }));

    expect(buildSkillsAddCommandPlanMock).toHaveBeenCalledWith({ repo: 'owner/repo', skillName: undefined });
    expect(buildSkillsCheckCommandPlanMock).toHaveBeenCalled();
    expect(buildSkillsUpdateCommandPlanMock).toHaveBeenCalled();
    expect(execSkillsCommandMock).toHaveBeenCalledWith({ command: 'npx', args: ['skills', 'add', 'mocked'] });
    expect(execSkillsCommandMock).toHaveBeenCalledWith({ command: 'npx', args: ['skills', 'check'] });
    expect(execSkillsCommandMock).toHaveBeenCalledWith({ command: 'npx', args: ['skills', 'update'] });
  });

  it('does not fall back to receipt.skillId as cli skillName for repo-only remote installs', async () => {
    const context = createContext(workspaceRoot);
    const larksuiteReceipt = remoteReceipt({
      id: 'receipt-larksuite-cli',
      skillId: 'remote-larksuite-cli',
      sourceId: 'skills-sh-directory',
      repo: 'larksuite/cli',
      result: 'approved_pending_install'
    });

    await finalizeRemoteSkillInstall(context, larksuiteReceipt);

    expect(context.install).toHaveBeenCalledWith({ repo: 'larksuite/cli', skillName: undefined });
    expect(context.publishToLab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'remote-larksuite-cli', name: 'larksuite/cli' })
    );
  });
});
