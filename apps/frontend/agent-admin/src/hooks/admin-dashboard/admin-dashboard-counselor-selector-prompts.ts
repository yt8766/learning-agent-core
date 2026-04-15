type CounselorSelectorStrategy = 'manual' | 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag';

interface SelectorPromptResult {
  selectorId: string;
  domain: string;
  strategy: CounselorSelectorStrategy;
  candidateIds: string[];
  defaultCounselorId: string;
  featureFlag?: string;
  weights?: number[];
}

export function promptCreateCounselorSelector(windowObject: Window): SelectorPromptResult | null {
  const selectorId = windowObject.prompt('输入 selectorId，例如 payment-selector-v2');
  if (!selectorId) {
    return null;
  }
  const domain = windowObject.prompt('输入 domain，例如 payment', 'general') ?? 'general';
  const strategy =
    (windowObject.prompt(
      '输入策略：manual / user-id / session-ratio / task-type / feature-flag',
      'task-type'
    ) as CounselorSelectorStrategy | null) ?? 'task-type';
  const candidateIds = splitPromptList(
    windowObject.prompt('输入 candidateIds，逗号分隔', `${domain}-counselor-v1`) ?? ''
  );
  if (!candidateIds.length) {
    return null;
  }
  const defaultCounselorId =
    windowObject.prompt('输入 defaultCounselorId', candidateIds[0] ?? `${domain}-counselor-v1`) ?? candidateIds[0]!;
  const featureFlag =
    strategy === 'feature-flag'
      ? (windowObject.prompt('输入 feature flag 名称', `${domain}_selector`) ?? undefined)
      : undefined;
  return {
    selectorId,
    domain,
    strategy,
    candidateIds,
    defaultCounselorId,
    featureFlag
  };
}

export function promptEditCounselorSelector(
  windowObject: Window,
  selector: {
    selectorId: string;
    domain: string;
    strategy: string;
    candidateIds: string[];
    defaultCounselorId: string;
    featureFlag?: string;
    weights?: number[];
    enabled: boolean;
  }
): (SelectorPromptResult & { enabled: boolean }) | null {
  const strategy =
    (windowObject.prompt(
      '更新策略：manual / user-id / session-ratio / task-type / feature-flag',
      selector.strategy
    ) as CounselorSelectorStrategy | null) ??
    ((selector.strategy as CounselorSelectorStrategy) || 'task-type');
  const candidateIds = splitPromptList(
    windowObject.prompt('更新 candidateIds，逗号分隔', selector.candidateIds.join(',')) ?? ''
  );
  if (!candidateIds.length) {
    return null;
  }
  const defaultCounselorId =
    windowObject.prompt('更新 defaultCounselorId', selector.defaultCounselorId) ?? selector.defaultCounselorId;
  const featureFlag =
    strategy === 'feature-flag'
      ? (windowObject.prompt('更新 feature flag', selector.featureFlag ?? `${selector.domain}_selector`) ??
        selector.featureFlag)
      : undefined;
  const weights =
    strategy === 'session-ratio'
      ? splitWeights(
          windowObject.prompt(
            '更新 weights，逗号分隔',
            selector.weights?.join(',') ?? candidateIds.map(() => '1').join(',')
          )
        )
      : undefined;

  return {
    selectorId: selector.selectorId,
    domain: selector.domain,
    strategy,
    candidateIds,
    defaultCounselorId,
    featureFlag,
    weights,
    enabled: selector.enabled
  };
}

function splitPromptList(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function splitWeights(value: string | null | undefined) {
  return value
    ?.split(',')
    .map(item => Number(item.trim()))
    .filter(item => Number.isFinite(item) && item > 0);
}
