import { MemoryBrowserCard } from './memory-browser-card';
import { MemoryGovernanceToolsCard } from './memory-governance-tools-card';

export function MemoryGovernancePanel(props: {
  onInvalidateMemory?: (memoryId: string) => Promise<void> | void;
  onRestoreMemory?: (memoryId: string) => Promise<void> | void;
  onRetireMemory?: (memoryId: string) => Promise<void> | void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <MemoryBrowserCard
        onInvalidateMemory={props.onInvalidateMemory}
        onRestoreMemory={props.onRestoreMemory}
        onRetireMemory={props.onRetireMemory}
      />
      <MemoryGovernanceToolsCard />
    </div>
  );
}
