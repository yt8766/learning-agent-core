import { Injectable } from '@nestjs/common';

import { CreateTaskDto } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class TasksService {
  constructor(private readonly runtimeService: RuntimeService) {}

  createTask(dto: CreateTaskDto) {
    return this.runtimeService.createTask(dto);
  }

  listTasks() {
    return this.runtimeService.listTasks();
  }

  getTask(taskId: string) {
    return this.runtimeService.getTask(taskId);
  }

  listTaskTraces(taskId: string) {
    return this.runtimeService.listTaskTraces(taskId);
  }

  listTaskAgents(taskId: string) {
    return this.runtimeService.listTaskAgents(taskId);
  }

  listTaskMessages(taskId: string) {
    return this.runtimeService.listTaskMessages(taskId);
  }

  getTaskPlan(taskId: string) {
    return this.runtimeService.getTaskPlan(taskId);
  }

  getTaskReview(taskId: string) {
    return this.runtimeService.getTaskReview(taskId);
  }

  retryTask(taskId: string) {
    return this.runtimeService.retryTask(taskId);
  }
}
