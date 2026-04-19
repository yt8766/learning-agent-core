import type { CreateAgentDiagnosisTaskDto, TaskRecord } from '@agent/core';

export function buildAgentDiagnosisTaskInput(
  dto: CreateAgentDiagnosisTaskDto,
  task: TaskRecord,
  recentTraceLines: string[]
) {
  const goal = [
    `请诊断任务 ${dto.taskId} 的 agent 错误并给出恢复方案。`,
    `原任务目标：${dto.goal ?? task.goal}`,
    `错误码：${dto.errorCode}`,
    dto.ministry ? `发生环节：${dto.ministry}` : '',
    task.currentNode ? `当前节点：${task.currentNode}` : '',
    task.currentStep ? `当前步骤：${task.currentStep}` : '',
    task.currentWorker ? `当前执行角色：${task.currentWorker}` : '',
    `错误信息：${dto.message}`,
    dto.diagnosisHint ? `已知诊断提示：${dto.diagnosisHint}` : '',
    dto.recommendedAction ? `当前建议动作：${dto.recommendedAction}` : '',
    dto.recoveryPlaybook?.length
      ? `建议恢复步骤：\n${dto.recoveryPlaybook.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
      : '',
    recentTraceLines.length ? `最近 Trace：\n${recentTraceLines.join('\n')}` : '',
    dto.stack ? `异常堆栈：\n${dto.stack}` : '',
    '请按首辅/刑部视角分析根因，并说明应直接重试、切换 provider/connector，还是先修复状态或审批链路。'
  ]
    .filter(Boolean)
    .join('\n');

  return {
    goal,
    context: `diagnosis_for:${dto.taskId}`,
    constraints: ['prefer-xingbu-diagnosis', 'preserve-trace-context']
  };
}
