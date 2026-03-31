import { describe, expect, it, vi } from 'vitest';

import { MemoryCrossCheckService } from '../../src/memory/memory-cross-check.service';
import { MemoryScrubberRunnerService } from '../../src/memory/memory-scrubber-runner.service';

describe('MemoryScrubberRunnerService', () => {
  it('运行 sweep 时会调用 runtime scrubber 并返回隔离结果', async () => {
    const scrubRecent = vi.fn(async () => [{ id: 'mem-1', quarantined: true }]);
    const runtimeKnowledgeService = {
      createMemoryScrubber: vi.fn(() => ({
        scrubRecent
      }))
    };
    const memoryCrossCheckService = {
      validate: vi.fn(async () => null)
    } as unknown as MemoryCrossCheckService;

    const service = new MemoryScrubberRunnerService(runtimeKnowledgeService as never, memoryCrossCheckService);
    const result = await service.runSweep();

    expect(runtimeKnowledgeService.createMemoryScrubber).toHaveBeenCalled();
    expect(scrubRecent).toHaveBeenCalledWith(20);
    expect(result).toEqual([{ id: 'mem-1', quarantined: true }]);
  });

  it('并发 sweep 时只允许一个执行中的任务', async () => {
    let resolver: ((value: unknown) => void) | null = null;
    const scrubRecent = vi.fn(
      () =>
        new Promise(resolve => {
          resolver = resolve;
        })
    );
    const runtimeKnowledgeService = {
      createMemoryScrubber: vi.fn(() => ({
        scrubRecent
      }))
    };
    const memoryCrossCheckService = {
      validate: vi.fn(async () => null)
    } as unknown as MemoryCrossCheckService;

    const service = new MemoryScrubberRunnerService(runtimeKnowledgeService as never, memoryCrossCheckService);
    const first = service.runSweep();
    const second = service.runSweep();
    resolver?.([]);

    await expect(first).resolves.toEqual([]);
    await expect(second).resolves.toEqual([]);
    expect(scrubRecent).toHaveBeenCalledTimes(1);
  });

  it('优先采用交叉校验服务给出的官方冲突结论', async () => {
    const validatorHolder: { validate?: (record: any) => Promise<any> } = {};
    const runtimeKnowledgeService = {
      createMemoryScrubber: vi.fn(({ validate }) => {
        validatorHolder.validate = validate;
        return {
          scrubRecent: vi.fn(async () => [])
        };
      })
    };
    const memoryCrossCheckService = {
      validate: vi.fn(async () => ({
        memoryId: 'mem-1',
        shouldQuarantine: true,
        reason: 'official conflict',
        category: 'conflicts_with_official_docs',
        evidenceRefs: ['official-rule:test']
      }))
    } as unknown as MemoryCrossCheckService;

    const service = new MemoryScrubberRunnerService(runtimeKnowledgeService as never, memoryCrossCheckService);
    await service.runSweep();
    const result = await validatorHolder.validate?.({
      id: 'mem-1',
      summary: '普通经验',
      content: '普通内容',
      tags: [],
      createdAt: '2026-03-28T00:00:00.000Z'
    });

    expect(result).toEqual(
      expect.objectContaining({
        category: 'conflicts_with_official_docs',
        evidenceRefs: ['official-rule:test']
      })
    );
  });
});
