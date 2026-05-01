import {
  BookMarked,
  BookOpen,
  BrainCircuit,
  Cable,
  ClipboardCheck,
  Database,
  FlaskConical,
  FolderKanban,
  IdCard,
  Radar,
  SquareTerminal,
  Users,
  Workflow
} from 'lucide-react';

import type { DashboardPageKey } from '@/types/admin';

export const NAV_ITEMS: Array<{
  key: DashboardPageKey;
  label: string;
  description: string;
  icon: typeof Radar;
}> = [
  { key: 'runtime', label: '运行中枢', description: '运行态、队列、活跃尚书与任务脉冲', icon: SquareTerminal },
  { key: 'approvals', label: '审批中枢', description: '待审批动作、批注反馈与风险阻塞', icon: ClipboardCheck },
  { key: 'learning', label: '学习中枢', description: '自动沉淀、候选待审与学习质量', icon: BrainCircuit },
  { key: 'workspace', label: 'Agent Workspace', description: '工作区、技能草稿与复用飞轮治理', icon: FolderKanban },
  { key: 'memory', label: '记忆中枢', description: '长期记忆治理、对比、回滚与效果洞察', icon: Database },
  { key: 'profiles', label: '画像中枢', description: '用户画像、偏好 patch 与作用域约束', icon: IdCard },
  { key: 'evals', label: '评测基线', description: 'benchmark 通过率、关键链路健康与回归基线', icon: FlaskConical },
  { key: 'archives', label: '归档中心', description: '长期归档、趋势窗口与导出管理', icon: Database },
  { key: 'skills', label: '技能工坊', description: '技能版本、成功率、晋升与禁用', icon: BookMarked },
  { key: 'evidence', label: '证据中心', description: '来源、证据链、trace 与可信度', icon: Radar },
  { key: 'connectors', label: '连接器与策略', description: 'MCP transport、capability 与策略健康', icon: Cable },
  {
    key: 'skillSources',
    label: '技能来源',
    description: '市场、来源优先级、安装回执与本地落库',
    icon: BookOpen
  },
  {
    key: 'companyAgents',
    label: '公司专员',
    description: '公司专员、归属六部、连接器依赖与治理状态',
    icon: Users
  },
  {
    key: 'workflowLab',
    label: '工作流实验室',
    description: '触发工作流、实时节点轨迹与历史运行记录',
    icon: Workflow
  }
];

export type AppSidebarNavItem = (typeof NAV_ITEMS)[number];
