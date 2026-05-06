import type { ArchitectureDiagramRecord, RuntimeArchitectureRecord } from '@/types/admin';

export const DIAGRAM_ORDER: Array<{ key: keyof RuntimeArchitectureRecord; label: string }> = [
  { key: 'project', label: '当前项目' },
  { key: 'agent', label: 'Agent' },
  { key: 'agentChat', label: 'agent-chat' },
  { key: 'agentAdmin', label: 'agent-admin' }
];

export function resolveActiveArchitectureDiagram(
  record: RuntimeArchitectureRecord | null,
  activeKey: keyof RuntimeArchitectureRecord
): ArchitectureDiagramRecord | null {
  if (!record) {
    return null;
  }
  return record[activeKey];
}

export function getArchitectureDiagramSummary(diagram: ArchitectureDiagramRecord) {
  return `${diagram.descriptor.nodes.length} nodes / ${diagram.descriptor.edges.length} routes`;
}
