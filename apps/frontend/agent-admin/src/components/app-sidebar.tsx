import * as React from 'react';
import {
  BookMarked,
  BookOpen,
  BrainCircuit,
  Building2,
  Cable,
  ChevronDown,
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

const PLATFORM_NESTED_PAGE_KEYS: DashboardPageKey[] = ['evals', 'archives', 'skills'];
const PLATFORM_NESTED_PARENT_KEY: DashboardPageKey = 'profiles';
const PLATFORM_NESTED_NAV_ID = 'admin-platform-nested-nav';

function isPlatformNestedPage(page: DashboardPageKey) {
  return PLATFORM_NESTED_PAGE_KEYS.includes(page);
}

export const NAV_ITEMS: Array<{
  key: DashboardPageKey;
  label: string;
  description: string;
  icon: typeof Radar;
}> = [
  { key: 'runtime', label: '运行中枢', description: '运行态、队列、活跃尚书与任务脉冲', icon: SquareTerminal },
  { key: 'approvals', label: '审批中枢', description: '待审批动作、批注反馈与风险阻塞', icon: ClipboardCheck },
  { key: 'learning', label: '学习中枢', description: '自动沉淀、候选待审与学习质量', icon: BrainCircuit },
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
  }
];

export function AppSidebar(
  props: AdminNavigationProps & {
    variant?: 'default' | 'inset';
    defaultPlatformNestedExpanded?: boolean;
  }
) {
  const {
    page,
    health,
    loading,
    polling,
    pendingApprovals,
    tasks,
    onNavigate,
    variant = 'inset',
    defaultPlatformNestedExpanded
  } = props;

  const platformPrimary = NAV_ITEMS.slice(0, 5);
  const platformNested = NAV_ITEMS.slice(5, 8);
  const [platformNestedExpanded, setPlatformNestedExpanded] = React.useState(
    () => defaultPlatformNestedExpanded ?? isPlatformNestedPage(page)
  );

  React.useEffect(() => {
    if (isPlatformNestedPage(page)) {
      setPlatformNestedExpanded(true);
    }
  }, [page]);

  const projects: Array<{ label: string; icon: typeof FolderKanban; key: DashboardPageKey }> = [
    { label: '技能来源治理', icon: FolderKanban, key: 'skillSources' },
    { label: '公司专员编排', icon: Users, key: 'companyAgents' }
  ];

  const utilityItems: Array<{ label: string; icon: typeof Database; key: DashboardPageKey }> = [
    { label: '证据与来源', icon: BookOpen, key: 'evidence' },
    { label: '连接器设置', icon: Settings2, key: 'connectors' }
  ];

  const controlDeckBadges = [
    { label: '健康状态', value: loading ? '加载中' : health || '待同步' },
    { label: '审批挂起', value: `${pendingApprovals}` },
    { label: '活跃任务', value: `${tasks.length}` }
  ];

  return (
    <Sidebar variant={variant} className="sticky top-0 h-screen overflow-hidden">
      <div className="flex h-full flex-col border-r border-[#e7e0d3] bg-[linear-gradient(180deg,#fcfaf5_0%,#f6f1e7_52%,#f3eee5_100%)] px-3 py-3">
        <div className="rounded-[1.75rem] border border-[#d9cfba] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,242,231,0.98)_100%)] p-4 shadow-[0_18px_50px_rgba(111,87,48,0.12)]">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f3d35] text-[#f6efe2] shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.08rem] font-semibold tracking-[0.02em] text-[#1e1c17]">六部治理台</p>
              <p className="mt-1 text-sm text-[#756b58]">agent-admin 指挥中控</p>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full border border-[#d7ccb7] bg-white/80 px-2.5 text-[0.72rem] font-medium text-[#5f5647]"
            >
              {polling ? '轮询中' : '就绪'}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {controlDeckBadges.map(item => (
              <div key={item.label} className="rounded-2xl bg-[#f7f0e3] px-3 py-2 text-left">
                <p className="text-[0.7rem] font-medium tracking-[0.04em] text-[#8a7c64]">{item.label}</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#2b2923]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-[#d7ccb7] bg-white/55 px-3 py-2 text-sm text-[#6d624f]">
            <Radar className="h-4 w-4 text-[#8d6d35]" />
            <span className="truncate">以治理视角总览运行、审批、学习、证据与策略。</span>
          </div>
        </div>

        <ScrollArea className="mt-5 flex-1 pr-1">
          <div className="space-y-8 pb-4">
            <div className="space-y-3">
              <div className="px-2">
                <p className="text-sm font-semibold tracking-[0.08em] text-[#7d725f]">治理中心与专项入口</p>
                <p className="mt-1 text-xs text-[#9b8e78]">先看主治理面，再进入专项与策略。</p>
              </div>
              <div className="space-y-1">
                {platformPrimary.map(item => {
                  const Icon = item.icon;
                  const active = item.key === page;
                  const hasChildren = item.key === PLATFORM_NESTED_PARENT_KEY;
                  const itemClasses = cn(
                    'w-full rounded-[1.15rem] border text-left transition',
                    active
                      ? 'border-[#d6b47b] bg-[linear-gradient(180deg,#fff8ec_0%,#f5e9d5_100%)] text-[#1d1b16] shadow-[0_10px_24px_rgba(163,123,58,0.14)]'
                      : 'border-transparent bg-transparent text-[#26231d] hover:border-[#e5d9c3] hover:bg-white/70'
                  );

                  if (!hasChildren) {
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onNavigate(item.key)}
                        className={cn(itemClasses, 'flex items-start gap-3 px-3 py-3')}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                            active ? 'bg-[#1f3d35] text-[#f4ead9]' : 'bg-[#efe6d6] text-[#5b4a31]'
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[1rem] font-semibold">{item.label}</span>
                            {item.key === 'approvals' ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full border border-[#d7ccb7] bg-white/90 text-[#5a5246]"
                              >
                                {pendingApprovals}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7a705e]">{item.description}</p>
                        </div>
                      </button>
                    );
                  }

                  return (
                    <div key={item.key} className={cn(itemClasses, 'flex items-start gap-2 px-3 py-3')}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.key)}
                        className="flex min-w-0 flex-1 items-start gap-3"
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                            active ? 'bg-[#1f3d35] text-[#f4ead9]' : 'bg-[#efe6d6] text-[#5b4a31]'
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[1rem] font-semibold">{item.label}</span>
                            {item.key === 'approvals' ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full border border-[#d7ccb7] bg-white/90 text-[#5a5246]"
                              >
                                {pendingApprovals}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7a705e]">{item.description}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={platformNestedExpanded ? '收起画像治理子导航' : '展开画像治理子导航'}
                        aria-expanded={platformNestedExpanded}
                        aria-controls={PLATFORM_NESTED_NAV_ID}
                        onClick={() => setPlatformNestedExpanded(current => !current)}
                        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#938775] transition hover:bg-white/70 hover:text-[#6d604b]"
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            platformNestedExpanded ? 'rotate-0' : '-rotate-90'
                          )}
                        />
                      </button>
                    </div>
                  );
                })}

                {platformNestedExpanded ? (
                  <div id={PLATFORM_NESTED_NAV_ID} className="ml-6 space-y-1 border-l border-[#ded4c5] pl-4">
                    {platformNested.map(item => {
                      const active = item.key === page;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => onNavigate(item.key)}
                          className={cn(
                            'block w-full rounded-xl px-3 py-2.5 text-left text-[0.96rem] transition',
                            active ? 'bg-white/85 font-medium text-[#241f17]' : 'text-[#5f5649] hover:bg-white/60'
                          )}
                        >
                          <p>{item.label}</p>
                          <p className="mt-1 text-xs text-[#908570]">{item.description}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {utilityItems.map(item => {
                  const Icon = item.icon;
                  const active = page === item.key;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[1.1rem] border border-transparent px-3 py-3 text-left transition',
                        active
                          ? 'border-[#daccb6] bg-white/85 text-[#1d1b16]'
                          : 'text-[#26231d] hover:border-[#e5d9c3] hover:bg-white/65'
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#efe6d6] text-[#5b4a31]">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.98rem] font-medium">{item.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="px-2">
                <p className="text-sm font-semibold tracking-[0.08em] text-[#7d725f]">专项编排</p>
                <p className="mt-1 text-xs text-[#9b8e78]">连接市场来源、组织专员和外部能力。</p>
              </div>
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
                        'flex w-full items-center gap-3 rounded-[1.1rem] border border-transparent px-3 py-3 text-left transition',
                        active
                          ? 'border-[#daccb6] bg-white/85 text-[#1d1b16]'
                          : 'text-[#26231d] hover:border-[#e5d9c3] hover:bg-white/65'
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#efe6d6] text-[#5b4a31]">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="flex-1 text-[0.98rem] font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="mt-3 border-t border-[#dfd5c6] pt-3">
          <div className="flex items-center gap-3 rounded-[1.4rem] border border-[#e5d9c6] bg-white/70 px-3 py-3">
            <img
              alt="当前值守用户"
              src="https://avatars.githubusercontent.com/u/124599?v=4"
              className="h-10 w-10 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1rem] font-semibold text-[#171717]">当前值守</p>
              <p className="truncate text-sm text-[#746a58]">治理席位 / m@example.com</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[#938775]" />
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
