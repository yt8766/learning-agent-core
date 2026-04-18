import { describe, expect, it, vi } from 'vitest';

import type { CreateAgentDiagnosisTaskDto, CreateTaskDto } from '@agent/core';

import { TasksService } from '../../src/modules/tasks/services/tasks.service';

describe('TasksService', () => {
  it('delegates task actions to RuntimeTaskService', () => {
    const runtimeTaskService = {
      createTask: vi.fn(),
      createAgentDiagnosisTask: vi.fn(),
      listTasks: vi.fn(),
      getTask: vi.fn(),
      listTaskTraces: vi.fn(),
      getTaskAudit: vi.fn(),
      listTaskAgents: vi.fn(),
      listTaskMessages: vi.fn(),
      getTaskPlan: vi.fn(),
      getTaskReview: vi.fn(),
      getTaskLocalSkillSuggestions: vi.fn(),
      retryTask: vi.fn()
    };
    const service = new TasksService(runtimeTaskService as any);
    const createTaskDto = { goal: 'fix build' } as CreateTaskDto;
    const diagnosisDto = {
      taskId: 'task-1',
      errorCode: 'timeout',
      message: 'timed out'
    } as CreateAgentDiagnosisTaskDto;

    service.createTask(createTaskDto);
    service.createAgentDiagnosisTask(diagnosisDto);
    service.listTasks();
    service.getTask('task-1');
    service.listTaskTraces('task-1');
    service.getTaskAudit('task-1');
    service.listTaskAgents('task-1');
    service.listTaskMessages('task-1');
    service.getTaskPlan('task-1');
    service.getTaskReview('task-1');
    service.getTaskLocalSkillSuggestions('task-1');
    service.retryTask('task-1');

    expect(runtimeTaskService.createTask).toHaveBeenCalledWith(createTaskDto);
    expect(runtimeTaskService.createAgentDiagnosisTask).toHaveBeenCalledWith(diagnosisDto);
    expect(runtimeTaskService.listTasks).toHaveBeenCalledTimes(1);
    expect(runtimeTaskService.getTask).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.listTaskTraces).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.getTaskAudit).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.listTaskAgents).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.listTaskMessages).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.getTaskPlan).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.getTaskReview).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.getTaskLocalSkillSuggestions).toHaveBeenCalledWith('task-1');
    expect(runtimeTaskService.retryTask).toHaveBeenCalledWith('task-1');
  });
});
