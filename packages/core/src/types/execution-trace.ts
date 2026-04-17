import { z } from 'zod';

import { ExecutionTraceSummaryRecordSchema, ThoughtChainStatusSchema } from '../spec/execution-trace';
import type { EvidenceRecord } from '../memory';
import type { ExecutionTrace } from './knowledge';
import type { ChatEventRecord, ChatThinkState, ChatThoughtChainItem } from './tasking-chat';

export type ThoughtChainStatus = z.infer<typeof ThoughtChainStatusSchema>;

export type SharedExecutionTrace = ExecutionTrace;
export type SharedEvidenceRecord = EvidenceRecord;
export type SharedChatEventRecord = ChatEventRecord;
export type SharedChatThoughtChainItem = ChatThoughtChainItem;
export type SharedChatThinkState = ChatThinkState;
export type ExecutionTraceSummaryRecord = z.infer<typeof ExecutionTraceSummaryRecordSchema>;
