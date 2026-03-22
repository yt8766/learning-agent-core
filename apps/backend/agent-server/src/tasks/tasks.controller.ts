import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateTaskDto } from '@agent/shared';

import { TasksService } from './tasks.service';

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

  @Get(':id')
  getTask(@Param('id') id: string) {
    return this.tasksService.getTask(id);
  }

  @Get(':id/traces')
  getTaskTraces(@Param('id') id: string) {
    return this.tasksService.listTaskTraces(id);
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

  @Post(':id/retry')
  retryTask(@Param('id') id: string) {
    return this.tasksService.retryTask(id);
  }
}
