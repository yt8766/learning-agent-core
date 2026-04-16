export class TaskCancelledError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} was cancelled.`);
  }
}

export class TaskBudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly detail?: Record<string, unknown>
  ) {
    super(message);
  }
}
