import { Injectable } from '@nestjs/common';

import { CreateAgentDiagnosisTaskDto, CreateTaskDto } from '@agent/shared';

import { RuntimeTaskService } from '../../../runtime/services/runtime-task.service';

@Injectable()
export class TasksService {
  constructor(private readonly runtimeTaskService: RuntimeTaskService) {}

  createTask(dto: CreateTaskDto) {
    return this.runtimeTaskService.createTask(dto);
  }

  createAgentDiagnosisTask(dto: CreateAgentDiagnosisTaskDto) {
    return this.runtimeTaskService.createAgentDiagnosisTask(dto);
  }

  listTasks() {
    return this.runtimeTaskService.listTasks();
  }

  getTask(taskId: string) {
    return this.runtimeTaskService.getTask(taskId);
  }

  listTaskTraces(taskId: string) {
    return this.runtimeTaskService.listTaskTraces(taskId);
  }

  getTaskAudit(taskId: string) {
    return this.runtimeTaskService.getTaskAudit(taskId);
  }

  listTaskAgents(taskId: string) {
    return this.runtimeTaskService.listTaskAgents(taskId);
  }

  listTaskMessages(taskId: string) {
    return this.runtimeTaskService.listTaskMessages(taskId);
  }

  getTaskPlan(taskId: string) {
    return this.runtimeTaskService.getTaskPlan(taskId);
  }

  getTaskReview(taskId: string) {
    return this.runtimeTaskService.getTaskReview(taskId);
  }

  getTaskLocalSkillSuggestions(taskId: string) {
    return this.runtimeTaskService.getTaskLocalSkillSuggestions(taskId);
  }

  retryTask(taskId: string) {
    return this.runtimeTaskService.retryTask(taskId);
  }
}
