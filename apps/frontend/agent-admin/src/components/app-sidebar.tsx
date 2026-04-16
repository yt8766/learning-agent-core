import {
  BookMarked,
  BookOpen,
  BrainCircuit,
  Building2,
  Cable,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  FlaskConical,
  FolderKanban,
  IdCard,
  Radar,
  Settings2,
  SquareTerminal,
  Users
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { DashboardPageKey, TaskRecord } from '@/types/admin';

export interface AdminNavigationProps {
  page: DashboardPageKey;
  health: string;
  loading: boolean;
  polling: boolean;
  pendingApprovals: number;
  tasks: TaskRecord[];
  activeTaskId?: string;
  refreshDiagnostics?: {
    scope: 'all' | 'center' | 'task';
    target: string;
    reason: string;
    outcome: 'started' | 'deduped' | 'throttled' | 'aborted' | 'completed' | 'failed';
    at: string;
  } | null;
  activeRefreshTargets?: Array<{
    scope: 'all' | 'center' | 'task';
    target: string;
    since: string;
  }>;
  onNavigate: (page: DashboardPageKey) => void;
  onRefresh: () => void;
  onQuickCreate: () => void;
  onSelectTask: (taskId: string) => void;
}

export const NAV_ITEMS: Array<{
  key: DashboardPageKey;
  label: string;
  description: string;
  icon: typeof Radar;
}> = [
  { key: 'runtime', label: 'Runtime Center', description: '运行态、队列、活跃尚书与任务脉冲', icon: SquareTerminal },
  { key: 'approvals', label: 'Approvals Center', description: '待审批动作、批注反馈与风险阻塞', icon: ClipboardCheck },
  { key: 'learning', label: 'Learning Center', description: '自动沉淀、候选待审与学习质量', icon: BrainCircuit },
  { key: 'memory', label: 'Memory Center', description: '长期记忆治理、对比、回滚与效果洞察', icon: Database },
  { key: 'profiles', label: 'Profile Center', description: '用户画像、偏好 patch 与作用域约束', icon: IdCard },
  { key: 'evals', label: 'Evals', description: 'benchmark 通过率、关键链路健康与回归基线', icon: FlaskConical },
  { key: 'archives', label: 'Archive Center', description: '长期归档、趋势窗口与导出管理', icon: Database },
  { key: 'skills', label: 'Skill Lab', description: '技能版本、成功率、晋升与禁用', icon: BookMarked },
  { key: 'evidence', label: 'Evidence Center', description: '来源、证据链、trace 与可信度', icon: Radar },
  { key: 'connectors', label: 'Connector & Policy', description: 'MCP transport、capability 与策略健康', icon: Cable },
  {
    key: 'skillSources',
    label: 'Skill Sources',
    description: '市场、来源优先级、安装回执与本地落库',
    icon: BookOpen
  },
  {
    key: 'companyAgents',
    label: 'Company Agents',
    description: '公司专员、归属六部、连接器依赖与治理状态',
    icon: Users
  }
];

export function AppSidebar(props: AdminNavigationProps & { variant?: 'default' | 'inset' }) {
  const { page, pendingApprovals, onNavigate, variant = 'inset' } = props;

  const platformPrimary = NAV_ITEMS.slice(0, 5);
  const platformNested = NAV_ITEMS.slice(5, 8);
  const nestedParentKeys = new Set<DashboardPageKey>(['runtime', 'learning', 'memory']);

  const projects: Array<{ label: string; icon: typeof FolderKanban; key: DashboardPageKey }> = [
    { label: 'Design Engineering', icon: FolderKanban, key: 'skillSources' },
    { label: 'Sales & Marketing', icon: Users, key: 'companyAgents' }
  ];

  const utilityItems: Array<{ label: string; icon: typeof Database; key: DashboardPageKey }> = [
    { label: 'Documentation', icon: BookOpen, key: 'evidence' },
    { label: 'Settings', icon: Settings2, key: 'connectors' }
  ];

  return (
    <Sidebar variant={variant} className="sticky top-0 h-screen overflow-hidden">
      <div className="flex h-full flex-col bg-[#fbfbfa] px-3 py-3">
        <div className="rounded-2xl bg-[#f6f6f4] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a1a18] text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.05rem] font-medium text-[#171717]">Acme Inc</p>
              <p className="text-sm text-muted-foreground">Enterprise</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <ScrollArea className="mt-5 flex-1 pr-1">
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="px-2 text-sm font-medium text-muted-foreground">Platform</p>
              <div className="space-y-1">
                {platformPrimary.map(item => {
                  const Icon = item.icon;
                  const active = item.key === page;
                  const hasChildren = nestedParentKeys.has(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[1.02rem] transition hover:bg-[#f2f2ef]',
                        active ? 'bg-[#f2f2ef] text-foreground' : 'text-foreground'
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 text-[#1f1f1d]" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {hasChildren ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : null}
                      {item.key === 'approvals' ? (
                        <Badge variant="secondary" className="rounded-full bg-[#ececeb] text-[#4a4a48]">
                          {pendingApprovals}
                        </Badge>
                      ) : null}
                    </button>
                  );
                })}

                <div className="ml-4 border-l border-border/80 pl-5">
                  {platformNested.map(item => {
                    const active = item.key === page;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onNavigate(item.key)}
                        className={cn(
                          'block w-full rounded-lg px-3 py-2 text-left text-[0.98rem] transition hover:bg-[#f2f2ef]',
                          active ? 'bg-[#f2f2ef] text-foreground' : 'text-[#2c2c2a]'
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {utilityItems.map(item => {
                  const Icon = item.icon;
                  const active = page === item.key;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[1.02rem] transition hover:bg-[#f2f2ef]',
                        active ? 'bg-[#f2f2ef] text-foreground' : 'text-foreground'
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 text-[#1f1f1d]" />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="px-2 text-sm font-medium text-muted-foreground">Projects</p>
              <div className="space-y-1">
                {projects.map(item => {
                  const Icon = item.icon;
                  const active = page === item.key;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[1.02rem] transition hover:bg-[#f2f2ef]',
                        active ? 'bg-[#f2f2ef] text-foreground' : 'text-foreground'
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 text-[#1f1f1d]" />
                      <span className="flex-1">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="mt-3 border-t border-border/70 pt-3">
          <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
            <img
              alt="shadcn"
              src="https://avatars.githubusercontent.com/u/124599?v=4"
              className="h-10 w-10 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.05rem] font-medium text-[#171717]">shadcn</p>
              <p className="truncate text-sm text-muted-foreground">m@example.com</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
