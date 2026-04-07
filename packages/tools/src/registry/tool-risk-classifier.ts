import { type RiskLevel } from '@agent/shared';

import { type McpCapabilityDefinition } from '../mcp/mcp-capability-registry';

export class ToolRiskClassifier {
  classify(capability?: Pick<McpCapabilityDefinition, 'riskLevel'>): RiskLevel {
    return capability?.riskLevel ?? 'medium';
  }

  requiresApproval(capability?: Pick<McpCapabilityDefinition, 'requiresApproval'>): boolean {
    return capability?.requiresApproval ?? false;
  }
}
