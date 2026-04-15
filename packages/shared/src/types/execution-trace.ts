import type { EvidenceRecord, ExecutionTrace } from './knowledge';
import type { ChatEventRecord, ChatThinkState, ChatThoughtChainItem } from './tasking';

export type ThoughtChainStatus = 'loading' | 'success' | 'error' | 'abort';

export type SharedExecutionTrace = ExecutionTrace;
export type SharedEvidenceRecord = EvidenceRecord;
export type SharedChatEventRecord = ChatEventRecord;
export type SharedChatThoughtChainItem = ChatThoughtChainItem;
export type SharedChatThinkState = ChatThinkState;

export interface ExecutionTraceSummaryRecord {
  freshnessSourceSummary?: string;
  citationSourceSummary?: string;
}
