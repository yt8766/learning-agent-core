import {
  BookOpenCheck,
  Cable,
  ChartNoAxesCombined,
  ClipboardCheck,
  KeyRound,
  RadioTower,
  Router,
  ServerCog,
  Sparkles
} from 'lucide-react';

export type GatewayCenterId =
  | 'runtime'
  | 'models'
  | 'providers'
  | 'keys'
  | 'logs'
  | 'connector-policy'
  | 'approvals'
  | 'evidence';

export const sidebarData = {
  navMain: [
    { id: 'runtime', title: '运行中枢', icon: RadioTower },
    { id: 'models', title: '模型中枢', icon: Router },
    { id: 'providers', title: '服务商中枢', icon: ServerCog },
    { id: 'keys', title: '凭证中枢', icon: KeyRound },
    { id: 'logs', title: '日志与成本', icon: ChartNoAxesCombined },
    { id: 'connector-policy', title: '连接器与策略', icon: Cable }
  ],
  documents: [
    { id: 'approvals', name: '审批中枢', icon: ClipboardCheck },
    { id: 'evidence', name: '证据中心', icon: BookOpenCheck }
  ]
} satisfies {
  navMain: Array<{ id: GatewayCenterId; title: string; icon: typeof RadioTower }>;
  documents: Array<{ id: GatewayCenterId; name: string; icon: typeof ClipboardCheck }>;
};

export const activityItems = [
  { label: '审批队列', value: '人工审批优先', icon: ClipboardCheck },
  { label: '运行编排', value: '支持取消与恢复的图运行', icon: RadioTower },
  { label: '兜底策略', value: '先成本后延迟', icon: Sparkles }
];
