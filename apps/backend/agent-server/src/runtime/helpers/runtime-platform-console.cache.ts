import type {
  PlatformConsoleCacheStatus,
  PlatformConsoleRecord,
  RuntimePlatformConsoleContext
} from '../centers/runtime-platform-console.records';

const PLATFORM_CONSOLE_CACHE_TTL_MS = 15_000;

const platformConsoleCache = new Map<
  string,
  {
    expiresAt: number;
    value: PlatformConsoleRecord;
  }
>();
const platformConsoleInFlight = new Map<string, Promise<PlatformConsoleRecord>>();
const platformConsoleContextIds = new WeakMap<RuntimePlatformConsoleContext, string>();
let platformConsoleContextSequence = 0;

export function readPlatformConsoleCache(cacheKey: string) {
  const cached = platformConsoleCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    return undefined;
  }

  return withPlatformConsoleCacheStatus(cached.value, 'hit');
}

export function readPlatformConsoleInFlight(cacheKey: string) {
  return platformConsoleInFlight.get(cacheKey);
}

export function setPlatformConsoleInFlight(cacheKey: string, request: Promise<PlatformConsoleRecord>) {
  platformConsoleInFlight.set(cacheKey, request);
  request.finally(() => {
    if (platformConsoleInFlight.get(cacheKey) === request) {
      platformConsoleInFlight.delete(cacheKey);
    }
  });
}

export function persistPlatformConsoleCache(cacheKey: string, record: PlatformConsoleRecord) {
  platformConsoleCache.set(cacheKey, {
    expiresAt: Date.now() + PLATFORM_CONSOLE_CACHE_TTL_MS,
    value: record
  });
  return record;
}

export function withPlatformConsoleCacheStatus(record: PlatformConsoleRecord, cacheStatus: PlatformConsoleCacheStatus) {
  return {
    ...record,
    diagnostics: {
      ...record.diagnostics,
      cacheStatus
    }
  };
}

export function buildPlatformConsoleCacheKey(
  context: RuntimePlatformConsoleContext,
  days: number,
  filters:
    | {
        status?: string;
        model?: string;
        pricingSource?: string;
        runtimeExecutionMode?: string;
        runtimeInteractionKind?: string;
        approvalsExecutionMode?: string;
        approvalsInteractionKind?: string;
      }
    | undefined,
  mode: 'full' | 'shell' = 'full'
) {
  return JSON.stringify({
    contextId: getPlatformConsoleContextId(context),
    mode,
    days,
    filters: {
      approvalsExecutionMode: filters?.approvalsExecutionMode ?? '',
      approvalsInteractionKind: filters?.approvalsInteractionKind ?? '',
      model: filters?.model ?? '',
      pricingSource: filters?.pricingSource ?? '',
      runtimeExecutionMode: filters?.runtimeExecutionMode ?? '',
      runtimeInteractionKind: filters?.runtimeInteractionKind ?? '',
      status: filters?.status ?? ''
    }
  });
}

export function resetPlatformConsoleCacheForTest() {
  platformConsoleCache.clear();
  platformConsoleInFlight.clear();
  platformConsoleContextSequence = 0;
}

function getPlatformConsoleContextId(context: RuntimePlatformConsoleContext) {
  const existing = platformConsoleContextIds.get(context);
  if (existing) {
    return existing;
  }

  platformConsoleContextSequence += 1;
  const nextId = `platform-console-context-${platformConsoleContextSequence}`;
  platformConsoleContextIds.set(context, nextId);
  return nextId;
}
