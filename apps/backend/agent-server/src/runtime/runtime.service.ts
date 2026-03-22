import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';

import { AgentOrchestrator, SessionCoordinator } from '@agent/agent-core';
import { FileMemoryRepository, FileRuntimeStateRepository } from '@agent/memory';
import {
  AppendChatMessageDto,
  ApprovalActionDto,
  ApprovalDecision,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  CreateChatSessionDto,
  CreateDocumentLearningJobDto,
  CreateTaskDto,
  LearningConfirmationDto,
  MemoryRecord,
  SearchMemoryDto,
  SessionApprovalDto,
  SkillCard,
  SkillStatus
} from '@agent/shared';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService } from '@agent/tools';

@Injectable()
export class RuntimeService implements OnModuleInit {
  private readonly memoryRepository = new FileMemoryRepository();
  private readonly skillRegistry = new SkillRegistry();
  private readonly approvalService = new ApprovalService();
  private readonly runtimeStateRepository = new FileRuntimeStateRepository();
  private readonly orchestrator = new AgentOrchestrator(
    this.memoryRepository,
    this.skillRegistry,
    this.approvalService,
    this.runtimeStateRepository
  );
  private readonly sessionCoordinator = new SessionCoordinator(
    this.orchestrator,
    this.runtimeStateRepository,
    this.memoryRepository,
    this.skillRegistry
  );

  async onModuleInit() {
    await this.sessionCoordinator.initialize();
  }

  describeGraph() {
    return this.orchestrator.describeGraph();
  }

  createTask(dto: CreateTaskDto) {
    return this.orchestrator.createTask(dto);
  }

  listTasks() {
    return this.orchestrator.listTasks();
  }

  listPendingApprovals() {
    return this.orchestrator.listPendingApprovals();
  }

  getTask(taskId: string) {
    const task = this.orchestrator.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    return task;
  }

  listTaskTraces(taskId: string) {
    return this.getTask(taskId).trace;
  }

  listTaskAgents(taskId: string) {
    this.getTask(taskId);
    return this.orchestrator.getTaskAgents(taskId);
  }

  listTaskMessages(taskId: string) {
    this.getTask(taskId);
    return this.orchestrator.getTaskMessages(taskId);
  }

  getTaskPlan(taskId: string) {
    const plan = this.orchestrator.getTaskPlan(taskId);
    if (!plan) {
      throw new NotFoundException(`Task plan for ${taskId} not found`);
    }
    return plan;
  }

  getTaskReview(taskId: string) {
    const review = this.orchestrator.getTaskReview(taskId);
    if (!review) {
      throw new NotFoundException(`Task review for ${taskId} not found`);
    }
    return review;
  }

  retryTask(taskId: string) {
    return this.orchestrator.retryTask(taskId).then(task => {
      if (!task) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }
      return task;
    });
  }

  approveTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.APPROVED).then(task => {
      if (!task) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }
      return task;
    });
  }

  rejectTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.REJECTED).then(task => {
      if (!task) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }
      return task;
    });
  }

  listSessions(): ChatSessionRecord[] {
    return this.sessionCoordinator.listSessions();
  }

  createSession(dto: CreateChatSessionDto): Promise<ChatSessionRecord> {
    return this.sessionCoordinator.createSession(dto);
  }

  getSession(sessionId: string): ChatSessionRecord {
    const session = this.sessionCoordinator.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  listSessionMessages(sessionId: string): ChatMessageRecord[] {
    this.getSession(sessionId);
    return this.sessionCoordinator.getMessages(sessionId);
  }

  listSessionEvents(sessionId: string): ChatEventRecord[] {
    this.getSession(sessionId);
    return this.sessionCoordinator.getEvents(sessionId);
  }

  getSessionCheckpoint(sessionId: string): ChatCheckpointRecord | undefined {
    this.getSession(sessionId);
    return this.sessionCoordinator.getCheckpoint(sessionId);
  }

  appendSessionMessage(sessionId: string, dto: AppendChatMessageDto): Promise<ChatMessageRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.appendMessage(sessionId, dto);
  }

  approveSessionAction(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.approve(sessionId, dto);
  }

  rejectSessionAction(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.reject(sessionId, dto);
  }

  confirmLearning(sessionId: string, dto: LearningConfirmationDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.confirmLearning(sessionId, dto);
  }

  recoverSession(sessionId: string): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.recover(sessionId);
  }

  subscribeSession(sessionId: string, listener: (event: ChatEventRecord) => void): () => void {
    this.getSession(sessionId);
    return this.sessionCoordinator.subscribe(sessionId, listener);
  }

  searchMemory(dto: SearchMemoryDto): Promise<MemoryRecord[]> {
    return this.memoryRepository.search(dto.query, dto.limit ?? 10);
  }

  async getMemory(memoryId: string): Promise<MemoryRecord> {
    const memory = await this.memoryRepository.getById(memoryId);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  listSkills(status?: SkillStatus): Promise<SkillCard[]> {
    return this.skillRegistry.list(status);
  }

  listLabSkills(): Promise<SkillCard[]> {
    return this.skillRegistry.list('lab');
  }

  async getSkill(skillId: string): Promise<SkillCard> {
    const skill = await this.skillRegistry.getById(skillId);
    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }
    return skill;
  }

  promoteSkill(skillId: string): Promise<SkillCard> {
    return this.skillRegistry.promote(skillId);
  }

  disableSkill(skillId: string): Promise<SkillCard> {
    return this.skillRegistry.disable(skillId);
  }

  listRules() {
    return this.orchestrator.listRules();
  }

  createDocumentLearningJob(dto: CreateDocumentLearningJobDto) {
    return this.orchestrator.createDocumentLearningJob(dto);
  }

  getLearningJob(jobId: string) {
    const job = this.orchestrator.getLearningJob(jobId);
    if (!job) {
      throw new NotFoundException(`Learning job ${jobId} not found`);
    }
    return job;
  }
}
