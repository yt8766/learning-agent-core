import { getMainChainNodeLabel } from '@/utils/runtime-semantics';

export function getChainNodeLabel(node?: string) {
  switch (node) {
    case 'entry_router':
    case 'mode_gate':
    case 'dispatch_planner':
    case 'context_filter':
    case 'result_aggregator':
    case 'interrupt_controller':
    case 'learning_recorder':
      return getMainChainNodeLabel(node);
    default:
      return node ?? '链路待推进';
  }
}
