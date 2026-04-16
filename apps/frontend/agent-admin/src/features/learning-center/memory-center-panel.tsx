import { MemoryGovernancePanel } from './memory-governance-panel';
import { MemoryUsageInsightCard } from './memory-usage-insight-card';

export function MemoryCenterPanel(props: {
  onInvalidateMemory?: (memoryId: string) => Promise<void> | void;
  onRestoreMemory?: (memoryId: string) => Promise<void> | void;
  onRetireMemory?: (memoryId: string) => Promise<void> | void;
}) {
  return (
    <div className="grid gap-4">
      <MemoryUsageInsightCard />
      <MemoryGovernancePanel
        onInvalidateMemory={props.onInvalidateMemory}
        onRestoreMemory={props.onRestoreMemory}
        onRetireMemory={props.onRetireMemory}
      />
    </div>
  );
}
