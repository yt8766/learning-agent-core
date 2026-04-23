import { loadSettings } from '../src/index.js';

const settings = loadSettings({
  workspaceRoot: process.cwd(),
  profile: 'company',
  overrides: {
    routing: {
      manager: {
        primary: 'demo/provider-manager'
      }
    },
    providers: [
      {
        id: 'demo',
        type: 'zhipu',
        displayName: 'Demo Provider',
        models: ['provider-manager']
      }
    ],
    policy: {
      approvalMode: 'strict',
      sourcePolicyMode: 'internal-only',
      budget: {
        stepBudget: 12,
        retryBudget: 2,
        sourceBudget: 3,
        maxCostPerTaskUsd: 1.5,
        fallbackModelId: 'demo-fallback'
      }
    }
  }
});

console.log(
  JSON.stringify(
    {
      profile: settings.profile,
      workspaceRoot: settings.workspaceRoot,
      approvalMode: settings.policy.approvalMode,
      sourcePolicyMode: settings.policy.sourcePolicyMode,
      managerRoute: settings.routing.manager.primary,
      providerIds: settings.providers.map(provider => provider.id)
    },
    null,
    2
  )
);
