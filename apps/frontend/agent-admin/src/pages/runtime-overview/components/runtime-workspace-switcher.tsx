import { cn } from '@/lib/utils';

import type { RuntimeOverviewWorkspaceKey } from './runtime-overview-types';

const WORKSPACE_ITEMS: Array<{
  key: RuntimeOverviewWorkspaceKey;
  label: string;
  description: string;
}> = [
  {
    key: 'queue',
    label: '运行队列',
    description: '聚焦当前 run 列表、选中任务和诊断动作。'
  },
  {
    key: 'analytics',
    label: '运行分析',
    description: '查看近周期趋势、模型占比与成本脉冲。'
  },
  {
    key: 'architecture',
    label: '架构视图',
    description: '单独查看运行时主链、部件关系与 Mermaid 结构。'
  }
];

export function RuntimeWorkspaceSwitcher({
  activeWorkspace,
  onWorkspaceChange
}: {
  activeWorkspace: RuntimeOverviewWorkspaceKey;
  onWorkspaceChange: (workspace: RuntimeOverviewWorkspaceKey) => void;
}) {
  return (
    <div className="rounded-[1.6rem] border border-[#ddd4c6] bg-[linear-gradient(180deg,#fffdfa_0%,#f7f1e7_100%)] p-4 shadow-[0_12px_32px_rgba(102,77,36,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.08em] text-[#786d59]">运行工作区</p>
          <h2 className="mt-1 text-[1.1rem] font-semibold text-[#1f1b14]">把运行视图拆成单独焦点区域</h2>
          <p className="mt-1 text-sm text-[#7f735f]">默认先看最常操作的队列区，分析和架构按需切换。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {WORKSPACE_ITEMS.map(item => {
            const active = item.key === activeWorkspace;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onWorkspaceChange(item.key)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-medium transition',
                  active
                    ? 'border-[#cda86f] bg-[#fff7ea] text-[#3b2d16] shadow-[0_8px_18px_rgba(173,126,55,0.16)]'
                    : 'border-[#ded2bd] bg-white/80 text-[#736751] hover:border-[#d0b78c] hover:bg-white'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {WORKSPACE_ITEMS.map(item => {
          const active = item.key === activeWorkspace;
          return (
            <div
              key={item.key}
              className={cn(
                'rounded-2xl border px-3 py-3 text-sm transition',
                active ? 'border-[#d6b47b] bg-white text-[#2a241a]' : 'border-[#e7dece] bg-[#faf6ef] text-[#8a7c67]'
              )}
            >
              <p className="font-semibold">{item.label}</p>
              <p className="mt-1 text-xs leading-5">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
