import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileSkillDraftRepository, SkillDraftService } from '../src/drafts';

const fixedTimes = [
  '2026-04-26T00:00:00.000Z',
  '2026-04-26T00:01:00.000Z',
  '2026-04-26T00:02:00.000Z',
  '2026-04-26T00:03:00.000Z'
];

function createClock(): () => Date {
  let index = 0;
  return () => new Date(fixedTimes[Math.min(index++, fixedTimes.length - 1)]);
}

describe('file skill draft repository', () => {
  let tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.map(root => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it('initializes an empty json file and reads drafts after repository restart', async () => {
    const filePath = await createDraftFilePath();
    const firstService = createFileBackedService(filePath);

    const draft = await firstService.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Persist sprint retrospective skill',
      bodyMarkdown: 'Summarize sprint retro notes and extract follow-up tasks.',
      sourceTaskId: 'task-1',
      source: 'learning-suggestion',
      riskLevel: 'low'
    });

    const restartedService = createFileBackedService(filePath);

    await expect(restartedService.getSkillDraft(draft.id)).resolves.toEqual(draft);
    await expect(restartedService.listSkillDrafts()).resolves.toEqual([draft]);
    await expect(readJsonFile(filePath)).resolves.toEqual([draft]);
  });

  it('persists status transitions across repository restart', async () => {
    const filePath = await createDraftFilePath();
    const firstService = createFileBackedService(filePath);
    const draft = await firstService.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Approve stable incident summary skill',
      bodyMarkdown: 'Create a stable incident summary with linked evidence.',
      sourceTaskId: 'task-1',
      source: 'workspace-vault',
      riskLevel: 'low'
    });

    const approved = await firstService.approveSkillDraft(draft.id, {
      reviewerId: 'reviewer-1'
    });

    const restartedService = createFileBackedService(filePath);

    await expect(restartedService.getSkillDraft(draft.id)).resolves.toEqual(approved);
    expect((await readJsonFile(filePath))[0]).toEqual(
      expect.objectContaining({
        id: draft.id,
        status: 'active',
        approvedBy: 'reviewer-1'
      })
    );
  });

  it('persists reuse stats across repository restart', async () => {
    const filePath = await createDraftFilePath();
    const firstService = createFileBackedService(filePath);
    const draft = await firstService.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Reuse release checklist skill',
      bodyMarkdown: 'Run the release checklist with evidence capture.',
      sourceTaskId: 'task-1',
      source: 'workspace-vault',
      riskLevel: 'low'
    });
    await firstService.approveSkillDraft(draft.id, {
      reviewerId: 'reviewer-1'
    });

    const reused = await firstService.recordSkillReuse(draft.id, {
      runId: 'run-42',
      reusedAt: '2026-04-26T10:30:00.000Z'
    });

    const restartedService = createFileBackedService(filePath);

    await expect(restartedService.getSkillDraft(draft.id)).resolves.toEqual(reused);
    expect((await readJsonFile(filePath))[0]?.reuseStats).toEqual({
      count: 1,
      lastRunId: 'run-42',
      lastReusedAt: '2026-04-26T10:30:00.000Z'
    });
  });

  it('does not persist raw metadata fields outside the draft contract', async () => {
    const filePath = await createDraftFilePath();
    const repository = new FileSkillDraftRepository({ filePath });
    const service = new SkillDraftService({
      repository,
      now: createClock(),
      createId: () => 'draft-with-raw-metadata'
    });
    const draft = await service.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Sanitize raw model metadata',
      bodyMarkdown: 'Use only the stable draft fields.',
      sourceTaskId: 'task-1',
      source: 'learning-suggestion',
      riskLevel: 'low'
    });

    await repository.update({
      ...draft,
      rawMetadata: {
        providerPayload: 'do-not-persist'
      }
    } as typeof draft & { rawMetadata: Record<string, unknown> });

    const rawFile = await readFile(filePath, 'utf8');
    const restartedRepository = new FileSkillDraftRepository({ filePath });

    expect(rawFile).not.toContain('rawMetadata');
    expect(rawFile).not.toContain('do-not-persist');
    await expect(restartedRepository.get(draft.id)).resolves.toEqual(draft);
  });

  async function createDraftFilePath(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'skill-draft-file-repository-'));
    tempRoots.push(root);
    return join(root, 'drafts.json');
  }
});

function createFileBackedService(filePath: string): SkillDraftService {
  return new SkillDraftService({
    repository: new FileSkillDraftRepository({ filePath }),
    now: createClock(),
    createId: () => 'draft-1'
  });
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}
