import type { RuntimeScheduleResolution } from './runtime-schedule.types';

export function resolveRuntimeSchedule(schedule: string): RuntimeScheduleResolution {
  const normalized = schedule.trim().toLowerCase();
  if (normalized === 'manual') {
    return {
      schedule,
      mode: 'manual',
      scheduleValid: true
    };
  }

  const minuteIntervalMatch = normalized.match(/^(daily|weekday)\s+every\s+(\d{1,2})\s*(m|min|mins|minute|minutes)$/i);
  if (minuteIntervalMatch) {
    const [, frequency, intervalText] = minuteIntervalMatch;
    const intervalMinutes = Number(intervalText);
    if (intervalMinutes < 1 || intervalMinutes > 59) {
      return {
        schedule,
        mode: 'invalid',
        scheduleValid: false
      };
    }

    return {
      schedule,
      mode: 'cron',
      scheduleValid: true,
      cron: `*/${intervalMinutes} * * * ${frequency === 'weekday' ? '1-5' : '*'}`
    };
  }

  const intervalMatch = normalized.match(/^(daily|weekday)\s+every\s+(\d{1,2})\s*(h|hour|hours)$/i);
  if (intervalMatch) {
    const [, frequency, intervalText] = intervalMatch;
    const intervalHours = Number(intervalText);
    if (intervalHours < 1 || intervalHours > 23) {
      return {
        schedule,
        mode: 'invalid',
        scheduleValid: false
      };
    }

    return {
      schedule,
      mode: 'cron',
      scheduleValid: true,
      cron: `0 */${intervalHours} * * ${frequency === 'weekday' ? '1-5' : '*'}`
    };
  }

  const match = normalized.match(/^(daily|weekday)\s+(\d{1,2}):(\d{2})$/i);
  if (!match) {
    return {
      schedule,
      mode: 'invalid',
      scheduleValid: false
    };
  }

  const [, frequency, hourText, minuteText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return {
      schedule,
      mode: 'invalid',
      scheduleValid: false
    };
  }

  return {
    schedule,
    mode: 'cron',
    scheduleValid: true,
    cron: frequency === 'weekday' ? `${minute} ${hour} * * 1-5` : `${minute} ${hour} * * *`
  };
}

export function computeNextRunAt(schedule: string, now: Date): Date {
  const resolution = resolveRuntimeSchedule(schedule);
  if (resolution.mode !== 'cron') {
    const fallback = new Date(now);
    fallback.setHours(11, 0, 0, 0);
    if (fallback.getTime() <= now.getTime()) {
      fallback.setDate(fallback.getDate() + 1);
    }
    return fallback;
  }

  const minuteIntervalMatch = schedule.match(/^(daily|weekday)\s+every\s+(\d{1,2})\s*(m|min|mins|minute|minutes)$/i);
  if (minuteIntervalMatch) {
    const [, frequency, intervalText] = minuteIntervalMatch;
    const intervalMinutes = Number(intervalText);
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    while (candidate.getMinutes() % intervalMinutes !== 0) {
      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    if (frequency.toLowerCase() === 'weekday') {
      while (candidate.getDay() === 0 || candidate.getDay() === 6) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
      }
    }

    return candidate;
  }

  const intervalMatch = schedule.match(/^(daily|weekday)\s+every\s+(\d{1,2})\s*(h|hour|hours)$/i);
  if (intervalMatch) {
    const [, frequency, intervalText] = intervalMatch;
    const intervalHours = Number(intervalText);
    const candidate = new Date(now);
    candidate.setMinutes(0, 0, 0);
    candidate.setHours(candidate.getHours() + 1);

    while (candidate.getHours() % intervalHours !== 0) {
      candidate.setHours(candidate.getHours() + 1);
    }

    if (frequency.toLowerCase() === 'weekday') {
      while (candidate.getDay() === 0 || candidate.getDay() === 6) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
        while (candidate.getHours() % intervalHours !== 0) {
          candidate.setHours(candidate.getHours() + 1);
        }
      }
    }

    return candidate;
  }

  const match = schedule.match(/^(daily|weekday)\s+(\d{1,2}):(\d{2})$/i);
  if (!match) {
    return now;
  }

  const [, frequency, hourText, minuteText] = match;
  const candidate = new Date(now);
  candidate.setHours(Number(hourText), Number(minuteText), 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  if (frequency.toLowerCase() === 'weekday') {
    while (candidate.getDay() === 0 || candidate.getDay() === 6) {
      candidate.setDate(candidate.getDate() + 1);
    }
  }
  return candidate;
}
