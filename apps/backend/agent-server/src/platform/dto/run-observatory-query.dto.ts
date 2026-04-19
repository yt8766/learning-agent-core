export class RunObservatoryQueryDto {
  status?: string;
  model?: string;
  pricingSource?: string;
  executionMode?: string;
  interactionKind?: string;
  q?: string;
  hasInterrupt?: string;
  hasFallback?: string;
  hasRecoverableCheckpoint?: string;
  limit?: string;
}
