import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../src/graphs/main/runtime/knowledge', () => ({
  isDiagnosisTask: vi.fn().mockReturnValue(false)
}));

import { MainGraphTaskDrafts } from '../../../../../src/graphs/main/tasking/drafts/main-graph-task-drafts';
import { isDiagnosisTask } from '../../../../../src/graphs/main/runtime/knowledge';

describe('MainGraphTaskDrafts', () => {
  const tasks = new Map<string, any>();

  describe('buildMemoryRecord', () => {
    it('builds a success memory record for a successful evaluation', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const record = drafts.buildMemoryRecord(
        'task-1',
        'build a website',
        { success: true } as any,
        { decision: 'approved', notes: ['good'] } as any,
        'execution completed successfully'
      );

      expect(record.type).toBe('success_case');
      expect(record.taskId).toBe('task-1');
      expect(record.summary).toContain('Successful multi-agent pattern');
      expect(record.tags).toContain('success');
      expect(record.qualityScore).toBe(0.85);
    });

    it('builds a failure memory record for a failed evaluation', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const record = drafts.buildMemoryRecord(
        'task-1',
        'deploy app',
        { success: false } as any,
        { decision: 'blocked', notes: ['failed'] } as any,
        'execution failed'
      );

      expect(record.type).toBe('failure_case');
      expect(record.summary).toContain('Failure pattern');
      expect(record.tags).toContain('failure');
      expect(record.qualityScore).toBe(0.7);
    });

    it('builds a diagnosis memory record when isDiagnosisTask returns true', () => {
      vi.mocked(isDiagnosisTask).mockReturnValueOnce(true);
      const drafts = new MainGraphTaskDrafts(tasks);
      const record = drafts.buildMemoryRecord(
        'task-1',
        'diagnose issue',
        { success: true } as any,
        { decision: 'approved', notes: [] } as any,
        'diagnosis complete'
      );

      expect(record.summary).toContain('Agent diagnosis pattern');
      expect(record.tags).toContain('diagnosis');
      expect(record.tags).toContain('recovery');
    });
  });

  describe('buildRuleRecord', () => {
    it('builds a rule record with task context', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const record = drafts.buildRuleRecord('task-1', 'execution summary');

      expect(record.name).toBeDefined();
      expect(record.conditions).toContain('taskId=task-1');
      expect(record.action).toBe('execution summary');
      expect(record.sourceTaskId).toBe('task-1');
    });
  });

  describe('buildSkillDraft', () => {
    it('builds a chat skill draft for chat-related goals', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const skill = drafts.buildSkillDraft('你是我的助手', 'execution');

      expect(skill.name).toContain('聊天');
      expect(skill.steps).toHaveLength(3);
      expect(skill.riskLevel).toBe('medium');
      expect(skill.source).toBe('execution');
      expect(skill.status).toBe('lab');
    });

    it('builds a chat skill for persona goals', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const skill = drafts.buildSkillDraft('扮演一个老师', 'document');
      expect(skill.name).toContain('聊天');
      expect(skill.source).toBe('document');
    });

    it('builds a chat skill for roleplay goals', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const skill = drafts.buildSkillDraft('persona roleplay assistant', 'execution');
      expect(skill.name).toContain('聊天');
    });

    it('builds an execution skill draft for non-chat goals', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const skill = drafts.buildSkillDraft('build a REST API', 'execution');

      expect(skill.name).toBe('多 Agent 执行模式');
      expect(skill.steps).toHaveLength(3);
      expect(skill.source).toBe('execution');
    });

    it('builds a document skill draft for document source', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const skill = drafts.buildSkillDraft('learn documentation', 'document');

      expect(skill.name).toBe('文档学习技能模式');
      expect(skill.source).toBe('document');
    });

    it('builds chat skill for Chinese chat keyword', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const skill = drafts.buildSkillDraft('让我们聊天吧', 'execution');
      expect(skill.name).toContain('聊天');
    });

    it('builds chat skill for persona keyword', () => {
      const drafts = new MainGraphTaskDrafts(tasks);
      const skill = drafts.buildSkillDraft('create a persona assistant', 'execution');
      expect(skill.name).toContain('聊天');
    });
  });
});
