import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatRunRecordSchema, type ChatRunRecord, type ChatRunRoute } from '@agent/core';

import { ChatRunRepository } from './chat-run.repository';

export type CreateChatRunInput = {
  sessionId: string;
  requestMessageId: string;
  responseMessageId?: string;
  taskId?: string;
  route: ChatRunRoute;
  modelId?: string;
};

@Injectable()
export class ChatRunService {
  constructor(private readonly repository: ChatRunRepository) {}

  createRun(input: CreateChatRunInput): ChatRunRecord {
    const now = new Date().toISOString();
    return this.repository.create(
      ChatRunRecordSchema.parse({
        id: `chat_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...input,
        status: 'queued',
        createdAt: now
      })
    );
  }

  listRuns(sessionId: string): ChatRunRecord[] {
    return this.repository.listBySession(sessionId);
  }

  getRun(runId: string): ChatRunRecord {
    const run = this.repository.get(runId);
    if (!run) {
      throw new NotFoundException(`Chat run ${runId} not found`);
    }
    return run;
  }

  cancelRun(runId: string): ChatRunRecord {
    const run = this.getRun(runId);
    return this.repository.update(
      ChatRunRecordSchema.parse({
        ...run,
        status: 'cancelled',
        completedAt: new Date().toISOString()
      })
    );
  }
}
