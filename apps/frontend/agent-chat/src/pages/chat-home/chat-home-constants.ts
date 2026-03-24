export type SessionFilter = 'all' | 'running' | 'approval' | 'failed' | 'completed';

export const AGENT_LABELS: Record<string, string> = {
  manager: '主 Agent',
  research: 'Research Agent',
  executor: 'Executor Agent',
  reviewer: 'Reviewer Agent'
};

export const EVENT_LABELS: Record<string, string> = {
  decree_received: '圣旨已接收',
  session_started: '会话启动',
  user_message: '用户消息',
  supervisor_planned: '首辅已规划',
  libu_routed: '吏部已路由',
  ministry_started: '尚书开始执行',
  ministry_reported: '尚书提交战报',
  skill_resolved: '流程模板已解析',
  skill_stage_started: '流程阶段开始',
  skill_stage_completed: '流程阶段完成',
  manager_planned: '主 Agent 规划',
  subtask_dispatched: '任务分派',
  research_progress: 'Research 进展',
  tool_selected: '工具选择',
  tool_called: '工具调用',
  approval_required: '等待审批',
  approval_resolved: '审批完成',
  approval_rejected_with_feedback: '打回并附批注',
  review_completed: 'Review 完成',
  learning_pending_confirmation: '等待学习确认',
  learning_confirmed: '学习已确认',
  conversation_compacted: '对话已压缩',
  assistant_token: '流式回复',
  assistant_message: 'Agent 回复',
  run_resumed: '流程已恢复',
  run_cancelled: '流程已终止',
  final_response_delta: '最终回复流式片段',
  final_response_completed: '最终回复完成',
  session_finished: '会话完成',
  session_failed: '会话失败'
};

export const FILTER_OPTIONS: Array<{ label: string; value: SessionFilter }> = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'running' },
  { label: '待审批', value: 'approval' },
  { label: '失败', value: 'failed' },
  { label: '已完成', value: 'completed' }
];

export const MINISTRY_LABELS: Record<string, string> = {
  libu: '吏部',
  hubu: '户部',
  libu_docs: '礼部',
  bingbu: '兵部',
  xingbu: '刑部',
  gongbu: '工部'
};
