import { describe, expect, it } from 'vitest';

import { resolveRuntimeSchedule, computeNextRunAt } from '../../../src/runtime/schedules/runtime-schedule.helpers';

describe('resolveRuntimeSchedule', () => {
  it('resolves manual schedule', () => {
    const result = resolveRuntimeSchedule('manual');
    expect(result.mode).toBe('manual');
    expect(result.scheduleValid).toBe(true);
  });

  it('resolves daily at specific time', () => {
    const result = resolveRuntimeSchedule('daily 09:00');
    expect(result.mode).toBe('cron');
    expect(result.scheduleValid).toBe(true);
    expect(result.cron).toBe('0 9 * * *');
  });

  it('resolves weekday at specific time', () => {
    const result = resolveRuntimeSchedule('weekday 14:30');
    expect(result.mode).toBe('cron');
    expect(result.scheduleValid).toBe(true);
    expect(result.cron).toBe('30 14 * * 1-5');
  });

  it('rejects invalid format', () => {
    const result = resolveRuntimeSchedule('invalid');
    expect(result.mode).toBe('invalid');
    expect(result.scheduleValid).toBe(false);
  });

  it('rejects out of range hour', () => {
    const result = resolveRuntimeSchedule('daily 25:00');
    expect(result.mode).toBe('invalid');
    expect(result.scheduleValid).toBe(false);
  });

  it('rejects out of range minute', () => {
    const result = resolveRuntimeSchedule('daily 12:60');
    expect(result.mode).toBe('invalid');
    expect(result.scheduleValid).toBe(false);
  });

  it('resolves daily every N minutes', () => {
    const result = resolveRuntimeSchedule('daily every 15 minutes');
    expect(result.mode).toBe('cron');
    expect(result.scheduleValid).toBe(true);
    expect(result.cron).toBe('*/15 * * * *');
  });

  it('resolves weekday every N minutes', () => {
    const result = resolveRuntimeSchedule('weekday every 30 min');
    expect(result.mode).toBe('cron');
    expect(result.scheduleValid).toBe(true);
    expect(result.cron).toBe('*/30 * * * 1-5');
  });

  it('rejects minute interval out of range (0)', () => {
    const result = resolveRuntimeSchedule('daily every 0 minutes');
    expect(result.mode).toBe('invalid');
    expect(result.scheduleValid).toBe(false);
  });

  it('rejects minute interval out of range (60)', () => {
    const result = resolveRuntimeSchedule('daily every 60 minutes');
    expect(result.mode).toBe('invalid');
    expect(result.scheduleValid).toBe(false);
  });

  it('resolves daily every N hours', () => {
    const result = resolveRuntimeSchedule('daily every 2 hours');
    expect(result.mode).toBe('cron');
    expect(result.scheduleValid).toBe(true);
    expect(result.cron).toBe('0 */2 * * *');
  });

  it('resolves weekday every N hours', () => {
    const result = resolveRuntimeSchedule('weekday every 4 hour');
    expect(result.mode).toBe('cron');
    expect(result.scheduleValid).toBe(true);
    expect(result.cron).toBe('0 */4 * * 1-5');
  });

  it('rejects hour interval out of range (0)', () => {
    const result = resolveRuntimeSchedule('daily every 0 hours');
    expect(result.mode).toBe('invalid');
    expect(result.scheduleValid).toBe(false);
  });

  it('rejects hour interval out of range (24)', () => {
    const result = resolveRuntimeSchedule('daily every 24 hours');
    expect(result.mode).toBe('invalid');
    expect(result.scheduleValid).toBe(false);
  });

  it('handles case insensitive input', () => {
    const result = resolveRuntimeSchedule('DAILY 09:00');
    expect(result.mode).toBe('cron');
    expect(result.cron).toBe('0 9 * * *');
  });

  it('trims whitespace', () => {
    const result = resolveRuntimeSchedule('  daily 09:00  ');
    expect(result.mode).toBe('cron');
  });

  it('accepts m/min/mins/minute/minutes suffixes', () => {
    expect(resolveRuntimeSchedule('daily every 5 m').mode).toBe('cron');
    expect(resolveRuntimeSchedule('daily every 5 min').mode).toBe('cron');
    expect(resolveRuntimeSchedule('daily every 5 mins').mode).toBe('cron');
    expect(resolveRuntimeSchedule('daily every 5 minute').mode).toBe('cron');
    expect(resolveRuntimeSchedule('daily every 5 minutes').mode).toBe('cron');
  });

  it('accepts h/hour/hours suffixes', () => {
    expect(resolveRuntimeSchedule('daily every 2 h').mode).toBe('cron');
    expect(resolveRuntimeSchedule('daily every 2 hour').mode).toBe('cron');
    expect(resolveRuntimeSchedule('daily every 2 hours').mode).toBe('cron');
  });
});

describe('computeNextRunAt', () => {
  it('returns next day for manual schedule when past 11:00', () => {
    const now = new Date('2026-05-11T15:00:00.000Z');
    const result = computeNextRunAt('manual', now);
    expect(result.getHours()).toBe(11);
    expect(result.getDate()).toBe(12);
  });

  it('returns today 11:00 for manual schedule when before 11:00', () => {
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    const result = computeNextRunAt('manual', now);
    expect(result.getHours()).toBe(11);
    expect(result.getDate()).toBe(now.getDate());
  });

  it('returns next matching minute for daily minute interval', () => {
    const now = new Date('2026-05-11T09:03:00.000Z');
    const result = computeNextRunAt('daily every 5 minutes', now);
    expect(result.getMinutes() % 5).toBe(0);
    expect(result.getMinutes()).toBeGreaterThan(3);
  });

  it('returns next matching minute for weekday minute interval', () => {
    // Use a Monday
    const now = new Date('2026-05-11T09:03:00.000Z');
    const result = computeNextRunAt('weekday every 10 minutes', now);
    expect(result.getMinutes() % 10).toBe(0);
  });

  it('skips weekend for weekday minute interval', () => {
    // Saturday
    const now = new Date('2026-05-09T09:03:00.000Z');
    const result = computeNextRunAt('weekday every 5 minutes', now);
    // Should be Monday
    expect(result.getDay()).not.toBe(0);
    expect(result.getDay()).not.toBe(6);
  });

  it('returns next matching hour for daily hour interval', () => {
    const now = new Date('2026-05-11T09:30:00.000Z');
    const result = computeNextRunAt('daily every 3 hours', now);
    expect(result.getHours() % 3).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns next matching hour for weekday hour interval', () => {
    const now = new Date('2026-05-11T09:30:00.000Z');
    const result = computeNextRunAt('weekday every 2 hours', now);
    expect(result.getHours() % 2).toBe(0);
  });

  it('skips weekend for weekday hour interval', () => {
    // Sunday
    const now = new Date('2026-05-10T09:00:00.000Z');
    const result = computeNextRunAt('weekday every 2 hours', now);
    expect(result.getDay()).not.toBe(0);
    expect(result.getDay()).not.toBe(6);
  });

  it('returns next day for daily schedule when past time', () => {
    const now = new Date('2026-05-11T15:00:00.000Z');
    const result = computeNextRunAt('daily 09:00', now);
    expect(result.getDate()).toBe(12);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns today for daily schedule when before time', () => {
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    const result = computeNextRunAt('daily 09:00', now);
    expect(result.getDate()).toBe(now.getDate());
    expect(result.getHours()).toBe(9);
  });

  it('skips weekend for weekday schedule', () => {
    // Friday afternoon
    const now = new Date('2026-05-08T15:00:00.000Z');
    const result = computeNextRunAt('weekday 09:00', now);
    expect(result.getDay()).toBe(1); // Monday
  });

  it('returns fallback 11:00 for unparseable schedule', () => {
    const now = new Date();
    now.setHours(15, 0, 0, 0);
    const result = computeNextRunAt('unparseable', now);
    // Unparseable schedule falls back to 11:00 next day (since 15:00 > 11:00)
    expect(result.getHours()).toBe(11);
    expect(result.getDate()).toBe(now.getDate() + 1);
  });
});
