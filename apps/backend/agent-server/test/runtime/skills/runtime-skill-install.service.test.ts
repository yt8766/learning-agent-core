import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildSkillsAddCommandMock, buildSkillsCheckCommandMock, buildSkillsUpdateCommandMock, execShellCommandMock } =
  vi.hoisted(() => ({
    buildSkillsAddCommandMock: vi.fn(() => 'npx skills add mocked'),
    buildSkillsCheckCommandMock: vi.fn(() => 'npx skills check mocked'),
    buildSkillsUpdateCommandMock: vi.fn(() => 'npx skills update mocked'),
    execShellCommandMock: vi.fn(async command => ({ stdout: command, stderr: '' }))
  }));

vi.mock('../../../src/runtime/skills/runtime-skill-cli', () => ({
  buildSkillsAddCommand: buildSkillsAddCommandMock,
  buildSkillsCheckCommand: buildSkillsCheckCommandMock,
  buildSkillsUpdateCommand: buildSkillsUpdateCommandMock,
  execShellCommand: execShellCommandMock
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

function createContext(root: string): RuntimeSkillInstallContext & {
  publishToLab: ReturnType<typeof vi.fn>;
  registerInstalledSkillWorker: ReturnType<typeof vi.fn>;
  fetchToStaging: ReturnType<typeof vi.fn>;
  promoteFromStaging: ReturnType<typeof vi.fn>;
  install: ReturnType<typeof vi.fn>;
  check: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
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
    skillRegistry: {
      publishToLab
    },
    skillArtifactFetcher: {
      fetchToStaging,
      promoteFromStaging
    },
    listSkillSources: vi.fn(async () => []),
    registerInstalledSkillWorker,
    remoteSkillCli: {
      install,
      check,
      update
    },
    publishToLab,
    fetchToStaging,
    promoteFromStaging,
    install,
    check,
    update
  };
}

describe('runtime-skill-install.service', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-skill-install-'));
    vi.restoreAllMocks();
    buildSkillsAddCommandMock.mockReturnValue('npx skills add mocked');
    buildSkillsCheckCommandMock.mockReturnValue('npx skills check mocked');
    buildSkillsUpdateCommandMock.mockReturnValue('npx skills update mocked');
    execShellCommandMock.mockResolvedValue({ stdout: 'ok', stderr: '' });
  });

  it('reads and writes receipts and installed skill records with dedupe', async () => {
    const context = createContext(workspaceRoot);

    await writeSkillInstallReceipt(context, {
      id: 'receipt-1',
      skillId: 'skill-a',
      version: '1.0.0',
      sourceId: 'source-a',
      status: 'approved',
      phase: 'approved',
      result: 'ready'
    } as any);
    await writeSkillInstallReceipt(context, {
      id: 'receipt-1',
      skillId: 'skill-a',
      version: '1.0.1',
      sourceId: 'source-a',
      status: 'installed',
      phase: 'installed',
      result: 'done'
    } as any);

    expect(await readSkillInstallReceipts(context)).toEqual([
      expect.objectContaining({
        id: 'receipt-1',
        version: '1.0.1',
        status: 'installed'
      })
    ]);
    await expect(getSkillInstallReceipt(context, 'missing')).rejects.toBeInstanceOf(NotFoundException);

    await writeInstalledSkillRecord(context, {
      skillId: 'skill-a',
      version: '1.0.0',
      sourceId: 'source-a',
      installLocation: '/tmp/one',
      installedAt: '2026-04-02T00:00:00.000Z',
      status: 'installed',
      receiptId: 'receipt-1'
    });
    await writeInstalledSkillRecord(context, {
      skillId: 'skill-a',
      version: '1.0.0',
      sourceId: 'source-a',
      installLocation: '/tmp/two',
      installedAt: '2026-04-02T00:00:01.000Z',
      status: 'installed',
      receiptId: 'receipt-1'
    });

    expect(await readInstalledSkillRecords(context)).toEqual([
      expect.objectContaining({
        skillId: 'skill-a',
        installLocation: '/tmp/two'
      })
    ]);
  });

  it('guards auto install by enabled source and finalizes local installs', async () => {
    const context = createContext(workspaceRoot);
    const manifest = {
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
      compatibility: '>=1.0.0'
    } as any;

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
    await expect(
      readFile(join(workspaceRoot, 'packages', 'internal', 'skill-local', '1.0.0', 'skill-local@1.0.0.json'), 'utf8')
    ).resolves.toContain('"skill-local"');
  });

  it('records failed local installs and cleans staging when artifact fetching throws', async () => {
    const context = createContext(workspaceRoot);
    context.fetchToStaging.mockRejectedValueOnce(new Error('artifact_broken'));
    const receipt = {
      id: 'receipt-failed',
      skillId: 'skill-failed',
      version: '1.0.0',
      sourceId: 'source-local',
      status: 'approved',
      phase: 'approved',
      result: 'ready'
    } as any;

    await expect(
      finalizeSkillInstall(
        context,
        {
          id: 'skill-failed',
          sourceId: 'source-local',
          name: 'Skill Failed',
          description: 'desc',
          version: '1.0.0',
          approvalPolicy: 'manual',
          riskLevel: 'low'
        } as any,
        { id: 'source-local', kind: 'marketplace', enabled: true } as any,
        receipt
      )
    ).rejects.toThrow('artifact_broken');

    const failedReceipt = await getSkillInstallReceipt(context, 'receipt-failed');
    expect(failedReceipt).toEqual(
      expect.objectContaining({
        status: 'failed',
        phase: 'failed',
        failureCode: 'artifact_broken',
        result: 'install_failed'
      })
    );
  });

  it('finalizes remote installs, validates missing repo, and delegates check/update', async () => {
    const context = createContext(workspaceRoot);
    const receipt = {
      id: 'receipt-remote',
      skillId: 'remote-skill',
      sourceId: 'source-remote',
      repo: 'owner/repo with spaces',
      skillName: 'skill/name',
      reason: 'capability gap',
      status: 'approved',
      phase: 'approved',
      result: 'ready'
    } as any;

    const installed = await finalizeRemoteSkillInstall(context, receipt);
    expect(installed).toEqual(
      expect.objectContaining({
        skillId: 'remote-skill',
        version: 'remote',
        installLocation: expect.stringContaining('owner-repo-with-spaces/skill-name/remote')
      })
    );
    expect(context.install).toHaveBeenCalledWith({ repo: 'owner/repo with spaces', skillName: 'skill/name' });
    expect(context.registerInstalledSkillWorker).toHaveBeenCalledWith(expect.objectContaining({ id: 'remote-skill' }));
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

    const receipt = {
      id: 'receipt-remote-failed',
      skillId: 'remote-failed',
      sourceId: 'source-remote',
      repo: 'owner/repo',
      status: 'approved',
      phase: 'approved',
      result: 'ready'
    } as any;

    await expect(finalizeRemoteSkillInstall(context, receipt)).rejects.toThrow('remote_cli_failed');
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
      finalizeRemoteSkillInstall(fallbackContext, {
        id: 'receipt-default-cli',
        skillId: 'remote-default',
        sourceId: 'source-remote',
        repo: 'owner/repo',
        status: 'approved',
        phase: 'approved',
        result: 'ready'
      } as any)
    ).resolves.toEqual(expect.objectContaining({ skillId: 'remote-default' }));

    expect(buildSkillsAddCommandMock).toHaveBeenCalledWith({ repo: 'owner/repo', skillName: undefined });
    expect(buildSkillsCheckCommandMock).toHaveBeenCalled();
    expect(buildSkillsUpdateCommandMock).toHaveBeenCalled();
    expect(execShellCommandMock).toHaveBeenCalledWith('npx skills add mocked');
    expect(execShellCommandMock).toHaveBeenCalledWith('npx skills check mocked');
    expect(execShellCommandMock).toHaveBeenCalledWith('npx skills update mocked');
  });

  it('does not fall back to receipt.skillId as cli skillName for repo-only remote installs', async () => {
    const context = createContext(workspaceRoot);
    const receipt = {
      id: 'receipt-larksuite-cli',
      skillId: 'remote-larksuite-cli',
      sourceId: 'skills-sh-directory',
      repo: 'larksuite/cli',
      status: 'approved',
      phase: 'approved',
      result: 'approved_pending_install'
    } as any;

    await finalizeRemoteSkillInstall(context, receipt);

    expect(context.install).toHaveBeenCalledWith({
      repo: 'larksuite/cli',
      skillName: undefined
    });
    expect(context.publishToLab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'remote-larksuite-cli',
        name: 'larksuite/cli'
      })
    );
  });
});
