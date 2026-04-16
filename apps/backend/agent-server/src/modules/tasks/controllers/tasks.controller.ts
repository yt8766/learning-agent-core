import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateAgentDiagnosisTaskDto, CreateTaskDto } from '@agent/shared';

import { TasksService } from '../services/tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  listTasks() {
    return this.tasksService.listTasks();
  }

  @Post()
  createTask(@Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(dto);
  }

  @Post('diagnosis')
  createAgentDiagnosisTask(@Body() dto: CreateAgentDiagnosisTaskDto) {
    return this.tasksService.createAgentDiagnosisTask(dto);
  }

  @Get(':id')
  getTask(@Param('id') id: string) {
    return this.tasksService.getTask(id);
  }

  @Get(':id/traces')
  getTaskTraces(@Param('id') id: string) {
    return this.tasksService.listTaskTraces(id);
  }

  @Get(':id/audit')
  getTaskAudit(@Param('id') id: string) {
    return this.tasksService.getTaskAudit(id);
  }

  @Get(':id/agents')
  getTaskAgents(@Param('id') id: string) {
    return this.tasksService.listTaskAgents(id);
  }

  @Get(':id/messages')
  getTaskMessages(@Param('id') id: string) {
    return this.tasksService.listTaskMessages(id);
  }

  @Get(':id/plan')
  getTaskPlan(@Param('id') id: string) {
    return this.tasksService.getTaskPlan(id);
  }

  @Get(':id/review')
  getTaskReview(@Param('id') id: string) {
    return this.tasksService.getTaskReview(id);
  }

  @Get(':id/local-skill-suggestions')
  getTaskLocalSkillSuggestions(@Param('id') id: string) {
    return this.tasksService.getTaskLocalSkillSuggestions(id);
  }

  @Post(':id/retry')
  retryTask(@Param('id') id: string) {
    return this.tasksService.retryTask(id);
  }
}
