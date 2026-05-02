import type { PlatformConsoleRecord } from '@/types/admin';

export interface SkillSourcesCenterPanelProps {
  skillSources: PlatformConsoleRecord['skillSources'];
  onSelectTask: (taskId: string) => void;
  onInstallSkill: (manifestId: string, sourceId?: string) => void;
  onApproveInstall: (receiptId: string) => void;
  onRejectInstall: (receiptId: string) => void;
  onEnableSource: (sourceId: string) => void;
  onDisableSource: (sourceId: string) => void;
  onSyncSource: (sourceId: string) => void;
}
