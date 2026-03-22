import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import {
  ActionIntent,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  LearningJob,
  TaskRecord
} from '@agent/shared';

export interface PendingExecutionRecord {
  taskId: string;
  intent: ActionIntent;
  toolName: string;
  researchSummary: string;
}

export interface RuntimeStateSnapshot {
  tasks: TaskRecord[];
  learningJobs: LearningJob[];
  pendingExecutions: PendingExecutionRecord[];
  chatSessions: ChatSessionRecord[];
  chatMessages: ChatMessageRecord[];
  chatEvents: ChatEventRecord[];
  chatCheckpoints: ChatCheckpointRecord[];
}

export interface RuntimeStateRepository {
  load(): Promise<RuntimeStateSnapshot>;
  save(snapshot: RuntimeStateSnapshot): Promise<void>;
}

export class FileRuntimeStateRepository implements RuntimeStateRepository {
  private readonly filePath = resolve(loadSettings().tasksStateFilePath);

  async load(): Promise<RuntimeStateSnapshot> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<RuntimeStateSnapshot>;
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        learningJobs: Array.isArray(parsed.learningJobs) ? parsed.learningJobs : [],
        pendingExecutions: Array.isArray(parsed.pendingExecutions) ? parsed.pendingExecutions : [],
        chatSessions: Array.isArray(parsed.chatSessions) ? parsed.chatSessions : [],
        chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
        chatEvents: Array.isArray(parsed.chatEvents) ? parsed.chatEvents : [],
        chatCheckpoints: Array.isArray(parsed.chatCheckpoints) ? parsed.chatCheckpoints : []
      };
    } catch {
      return {
        tasks: [],
        learningJobs: [],
        pendingExecutions: [],
        chatSessions: [],
        chatMessages: [],
        chatEvents: [],
        chatCheckpoints: []
      };
    }
  }

  async save(snapshot: RuntimeStateSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }
}
