import { RiskLevel } from '@agent/shared';

import { McpCapabilityDefinition } from './mcp-capability-registry';

export class ToolRiskClassifier {
  classify(capability?: McpCapabilityDefinition): RiskLevel {
    return capability?.riskLevel ?? 'medium';
  }

  requiresApproval(capability?: McpCapabilityDefinition): boolean {
    return capability?.requiresApproval ?? false;
  }
}
