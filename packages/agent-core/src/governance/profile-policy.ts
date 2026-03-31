import { ProfilePolicyHintRecord, RuntimeProfile, SourcePolicyMode, WorkerDefinition } from '@agent/shared';

export function describeSkillSourceProfilePolicy(
  sourceId: string,
  profile: RuntimeProfile,
  sourcePolicyMode: SourcePolicyMode
): ProfilePolicyHintRecord {
  if (sourceId === 'bundled-marketplace') {
    const enabledByProfile = profile === 'personal' || sourcePolicyMode === 'open-web-allowed';
    return {
      enabledByProfile,
      recommendedForProfiles: ['personal'],
      reason: enabledByProfile
        ? '当前 profile 允许使用 marketplace 作为补充来源。'
        : `当前 ${profile} profile 默认优先内部/受控来源，bundled marketplace 不作为默认来源。`
    };
  }

  return {
    enabledByProfile: true,
    recommendedForProfiles: ['platform', 'company', 'personal', 'cli'],
    reason: '内部或本地来源默认对所有 profile 开放。'
  };
}

export function describeConnectorProfilePolicy(connectorId: string, profile: RuntimeProfile): ProfilePolicyHintRecord {
  const normalizedId = connectorId.toLowerCase();
  const companyOnly =
    normalizedId.includes('internal') ||
    normalizedId.includes('feishu') ||
    normalizedId.includes('lark') ||
    normalizedId.includes('security') ||
    normalizedId.includes('jira') ||
    normalizedId.includes('repo') ||
    normalizedId.includes('ci');
  const personalOnly =
    normalizedId.includes('gmail') ||
    normalizedId.includes('calendar') ||
    normalizedId.includes('notion') ||
    normalizedId.includes('local-mail');

  if (companyOnly) {
    const enabledByProfile = profile !== 'personal';
    return {
      enabledByProfile,
      recommendedForProfiles: ['platform', 'company', 'cli'],
      reason: enabledByProfile
        ? '该 connector 面向平台/公司治理与协同链路。'
        : '该 connector 默认属于公司/平台域，不会在 personal profile 中默认开放。'
    };
  }

  if (personalOnly) {
    const enabledByProfile = profile === 'personal' || profile === 'cli';
    return {
      enabledByProfile,
      recommendedForProfiles: ['personal', 'cli'],
      reason: enabledByProfile
        ? '该 connector 面向个人工作流。'
        : '该 connector 默认属于个人域，不会在 company/platform profile 中默认开放。'
    };
  }

  return {
    enabledByProfile: true,
    recommendedForProfiles: ['platform', 'company', 'personal', 'cli'],
    reason: '该 connector 属于通用域，可由所有 profile 使用。'
  };
}

export function describeWorkerProfilePolicy(
  worker: WorkerDefinition,
  profile: RuntimeProfile
): ProfilePolicyHintRecord {
  if (worker.kind === 'company' && profile === 'personal') {
    return {
      enabledByProfile: false,
      recommendedForProfiles: ['platform', 'company', 'cli'],
      reason: '公司专员默认只在 platform/company/cli profile 中参与路由。'
    };
  }

  for (const connectorId of worker.requiredConnectors ?? []) {
    const connectorPolicy = describeConnectorProfilePolicy(connectorId, profile);
    if (!connectorPolicy.enabledByProfile) {
      return {
        enabledByProfile: false,
        recommendedForProfiles: connectorPolicy.recommendedForProfiles,
        reason: `${worker.displayName} 依赖 connector ${connectorId}，但该 connector 在当前 ${profile} profile 中不可用。`
      };
    }
  }

  if (worker.kind === 'company') {
    return {
      enabledByProfile: true,
      recommendedForProfiles: ['platform', 'company', 'cli'],
      reason: '公司专员可在平台/公司运行时中参与路由。'
    };
  }

  if (worker.kind === 'installed-skill') {
    return {
      enabledByProfile: true,
      recommendedForProfiles: ['platform', 'company', 'personal', 'cli'],
      reason: '已安装技能 worker 会遵循自身 connector/capability 约束参与路由。'
    };
  }

  return {
    enabledByProfile: true,
    recommendedForProfiles: ['platform', 'company', 'personal', 'cli'],
    reason: '核心 worker 对所有 profile 开放。'
  };
}
