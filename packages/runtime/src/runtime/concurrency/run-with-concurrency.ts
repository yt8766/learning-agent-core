export type RunWithConcurrencyProgressStatus = 'started' | 'fulfilled' | 'rejected';

export interface RunWithConcurrencyWorkerContext {
  signal?: AbortSignal;
}

export interface RunWithConcurrencyProgressEvent<TResult = unknown> {
  status: RunWithConcurrencyProgressStatus;
  index: number;
  active: number;
  completed: number;
  value?: TResult;
  reason?: unknown;
}

export interface RunWithConcurrencyOptions<TResult = unknown> {
  maxConcurrency: number;
  signal?: AbortSignal;
  stopOnError?: boolean;
  onProgress?: (event: RunWithConcurrencyProgressEvent<TResult>) => void;
}

export type RunWithConcurrencySettledResult<TResult> =
  | {
      status: 'fulfilled';
      index: number;
      value: TResult;
    }
  | {
      status: 'rejected';
      index: number;
      reason: unknown;
    };

export interface RunWithConcurrencyResult<TResult> {
  results: Array<TResult | undefined>;
  settled: Array<RunWithConcurrencySettledResult<TResult>>;
  fulfilledCount: number;
  rejectedCount: number;
  cancelled: boolean;
}

export async function runWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  worker: (item: TItem, index: number, context: RunWithConcurrencyWorkerContext) => Promise<TResult>,
  options: RunWithConcurrencyOptions<TResult>
): Promise<RunWithConcurrencyResult<TResult>>;
export async function runWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  worker: (item: TItem, index: number, context: RunWithConcurrencyWorkerContext) => Promise<TResult>,
  maxConcurrency: number
): Promise<RunWithConcurrencyResult<TResult>>;
export async function runWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  worker: (item: TItem, index: number, context: RunWithConcurrencyWorkerContext) => Promise<TResult>,
  optionsOrMaxConcurrency: RunWithConcurrencyOptions<TResult> | number
): Promise<RunWithConcurrencyResult<TResult>> {
  const options = normalizeRunWithConcurrencyOptions(optionsOrMaxConcurrency);
  const results = new Array<TResult | undefined>(items.length).fill(undefined);
  const settledByIndex = new Array<RunWithConcurrencySettledResult<TResult> | undefined>(items.length);

  if (items.length === 0) {
    return {
      results,
      settled: [],
      fulfilledCount: 0,
      rejectedCount: 0,
      cancelled: Boolean(options.signal?.aborted)
    };
  }

  const workerCount = Math.max(1, Math.min(options.maxConcurrency, items.length));
  let nextIndex = 0;
  let active = 0;
  let completed = 0;
  let shouldStop = false;

  const emit = (event: Omit<RunWithConcurrencyProgressEvent<TResult>, 'active' | 'completed'>) => {
    options.onProgress?.({ ...event, active, completed });
  };

  const claimNextIndex = () => {
    if (shouldStop || options.signal?.aborted || nextIndex >= items.length) {
      return undefined;
    }
    const index = nextIndex;
    nextIndex += 1;
    return index;
  };

  async function spawn() {
    while (true) {
      const index = claimNextIndex();
      if (index === undefined) {
        return;
      }

      active += 1;
      emit({ status: 'started', index });

      try {
        const item = items[index] as TItem;
        const value = await worker(item, index, { signal: options.signal });
        results[index] = value;
        settledByIndex[index] = { status: 'fulfilled', index, value };
        completed += 1;
        active -= 1;
        emit({ status: 'fulfilled', index, value });
      } catch (reason) {
        settledByIndex[index] = { status: 'rejected', index, reason };
        completed += 1;
        active -= 1;
        if (options.stopOnError) {
          shouldStop = true;
        }
        emit({ status: 'rejected', index, reason });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => spawn()));

  const settled = settledByIndex.filter((item): item is RunWithConcurrencySettledResult<TResult> => item !== undefined);

  return {
    results,
    settled,
    fulfilledCount: settled.filter(item => item.status === 'fulfilled').length,
    rejectedCount: settled.filter(item => item.status === 'rejected').length,
    cancelled: Boolean(options.signal?.aborted)
  };
}

function normalizeRunWithConcurrencyOptions<TResult>(
  optionsOrMaxConcurrency: RunWithConcurrencyOptions<TResult> | number
): RunWithConcurrencyOptions<TResult> {
  const options =
    typeof optionsOrMaxConcurrency === 'number' ? { maxConcurrency: optionsOrMaxConcurrency } : optionsOrMaxConcurrency;
  const maxConcurrency = Number.isFinite(options.maxConcurrency) ? Math.floor(options.maxConcurrency) : 1;

  return {
    ...options,
    maxConcurrency: Math.max(1, maxConcurrency)
  };
}
