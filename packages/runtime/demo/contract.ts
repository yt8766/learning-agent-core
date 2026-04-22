import { LearningFlow, listApprovalScopePolicies, listGovernanceProfiles } from '../src/index.js';
import * as governanceExports from '../src/governance/index.js';
import * as observabilityExports from '../src/runtime-observability/index.js';

console.log(
  JSON.stringify(
    {
      governanceAligned:
        listApprovalScopePolicies === governanceExports.listApprovalScopePolicies &&
        listGovernanceProfiles === governanceExports.listGovernanceProfiles,
      learningFlowExported: typeof LearningFlow === 'function',
      observabilityExported:
        typeof observabilityExports.resolveTaskExecutionMode === 'function' &&
        typeof observabilityExports.resolveTaskInteractionKind === 'function'
    },
    null,
    2
  )
);
