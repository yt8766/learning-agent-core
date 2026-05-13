import type { LogMeta } from './app-logger.service';

export type RuntimeLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';
export type PersistedLogChannel = 'error' | 'warn' | 'audit' | 'performance';

interface ResolvedPersistedLogParams {
  level: RuntimeLevel;
  context: string;
  event?: string;
  statusCode?: number;
}

interface PersistedLogRule {
  channel: PersistedLogChannel;
  minLevel: RuntimeLevel;
  matches: (params: ResolvedPersistedLogParams) => boolean;
}

const AUDIT_EVENT_PREFIXES = [
  'approval-policy.',
  'learning-conflict.',
  'skill-source.',
  'skill.installation.',
  'connector.',
  'company-worker.',
  'counselor-selector.'
] as const;

const PERFORMANCE_EVENT_PREFIXES = ['runtime.platform_console.'] as const;
const WARN_CONTEXTS = new Set(['RuntimeScheduleService', 'MemoryScrubberRunnerService']);
const LEVEL_RANK: Record<RuntimeLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4
};

const PERSISTED_LOG_RULES: PersistedLogRule[] = [
  {
    channel: 'error',
    minLevel: 'error',
    matches: params => params.level === 'error'
  },
  {
    channel: 'performance',
    minLevel: 'info',
    matches: params => matchesEventPrefixes(params.event, PERFORMANCE_EVENT_PREFIXES)
  },
  {
    channel: 'audit',
    minLevel: 'info',
    matches: params => matchesEventPrefixes(params.event, AUDIT_EVENT_PREFIXES)
  },
  {
    channel: 'warn',
    minLevel: 'warn',
    matches: params => (params.statusCode === undefined ? WARN_CONTEXTS.has(params.context) : params.statusCode >= 500)
  }
];

export function resolvePersistedLogChannels(params: {
  level: RuntimeLevel;
  message: unknown;
  meta: LogMeta;
}): PersistedLogChannel[] {
  if (params.level === 'error') {
    return ['error'];
  }

  const resolved: ResolvedPersistedLogParams = {
    level: params.level,
    context: params.meta.context ?? 'Application',
    event: resolveLogEvent(params.message),
    statusCode: resolveStatusCode(params.message)
  };

  return PERSISTED_LOG_RULES.filter(rule => matchesLevel(resolved.level, rule.minLevel) && rule.matches(resolved)).map(
    rule => rule.channel
  );
}

function resolveLogEvent(message: unknown): string | undefined {
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message) as unknown;
      return isRecord(parsed) && typeof parsed.event === 'string' ? parsed.event : undefined;
    } catch {
      return undefined;
    }
  }

  return isRecord(message) && typeof message.event === 'string' ? message.event : undefined;
}

function resolveStatusCode(message: unknown): number | undefined {
  if (isRecord(message) && typeof message.statusCode === 'number') {
    return message.statusCode;
  }

  return undefined;
}

function matchesLevel(level: RuntimeLevel, minLevel: RuntimeLevel) {
  return LEVEL_RANK[level] <= LEVEL_RANK[minLevel];
}

function matchesEventPrefixes(event: string | undefined, prefixes: readonly string[]) {
  return typeof event === 'string' && prefixes.some(prefix => event.startsWith(prefix));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
