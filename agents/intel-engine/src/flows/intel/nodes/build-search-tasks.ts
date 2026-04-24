import type { PatrolGraphState, PatrolSearchTask } from '../schemas/patrol-graph-state.schema';

type BuildSearchTasksNodeInput = Pick<PatrolGraphState, 'jobId' | 'topics'> & Partial<PatrolGraphState>;

export function buildSearchTasksNode(input: BuildSearchTasksNodeInput): PatrolGraphState {
  const searchTasks: PatrolSearchTask[] = input.topics.flatMap(topic =>
    topic.queries.map((query, index) => ({
      taskId: `${input.jobId}:${topic.key}:${index}`,
      topicKey: topic.key,
      query,
      priorityDefault: topic.priorityDefault,
      recencyHours: topic.recencyHours,
      mode: input.mode ?? 'patrol'
    }))
  );

  return {
    ...input,
    searchTasks
  } as PatrolGraphState;
}
