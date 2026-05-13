import { describe, expect, it } from 'vitest';

import {
  createInMemoryScheduleRepository,
  getDefaultScheduleRepository,
  type ScheduledTaskRecord
} from '../../src/scheduling/schedule-repository';

function makeSchedule(overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord {
  return {
    id: 'sched-001',
    name: 'Daily backup',
    prompt: 'Run daily backup job',
    schedule: '0 2 * * *',
    status: 'active',
    cwd: '/workspace',
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'sandbox-tool',
    ...overrides
  };
}

describe('createInMemoryScheduleRepository', () => {
  it('creates and retrieves a schedule by id', async () => {
    const repo = createInMemoryScheduleRepository();
    const schedule = makeSchedule();
    await repo.createSchedule(schedule);

    const result = await repo.readSchedule('sched-001');
    expect(result).toEqual(schedule);
  });

  it('throws a project-owned error when schedule is not found', async () => {
    const repo = createInMemoryScheduleRepository();
    await expect(repo.readSchedule('nonexistent')).rejects.toThrow('Scheduled task nonexistent was not found.');
  });

  it('lists all stored schedules', async () => {
    const repo = createInMemoryScheduleRepository();
    await repo.createSchedule(makeSchedule({ id: 's1' }));
    await repo.createSchedule(makeSchedule({ id: 's2' }));

    const list = await repo.listSchedules();
    expect(list).toHaveLength(2);
    expect(list.map(s => s.id)).toEqual(expect.arrayContaining(['s1', 's2']));
  });

  it('returns empty list when no schedules exist', async () => {
    const repo = createInMemoryScheduleRepository();
    expect(await repo.listSchedules()).toEqual([]);
  });

  it('updates an existing schedule', async () => {
    const repo = createInMemoryScheduleRepository();
    await repo.createSchedule(makeSchedule());

    const updated = makeSchedule({ status: 'cancelled', cancelledAt: '2026-02-01T00:00:00.000Z' });
    await repo.updateSchedule(updated);

    const result = await repo.readSchedule('sched-001');
    expect(result.status).toBe('cancelled');
    expect(result.cancelledAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('updateSchedule can create a new entry (upsert behavior)', async () => {
    const repo = createInMemoryScheduleRepository();
    const schedule = makeSchedule({ id: 'new-sched' });
    await repo.updateSchedule(schedule);

    const result = await repo.readSchedule('new-sched');
    expect(result.id).toBe('new-sched');
  });

  it('stores stable source field as sandbox-tool', async () => {
    const repo = createInMemoryScheduleRepository();
    const schedule = makeSchedule();
    await repo.createSchedule(schedule);
    const result = await repo.readSchedule('sched-001');
    expect(result.source).toBe('sandbox-tool');
  });
});

describe('getDefaultScheduleRepository', () => {
  it('returns a singleton repository instance', () => {
    const repo1 = getDefaultScheduleRepository();
    const repo2 = getDefaultScheduleRepository();
    expect(repo1).toBe(repo2);
  });
});
