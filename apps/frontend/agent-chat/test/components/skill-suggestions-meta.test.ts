import { describe, expect, it } from 'vitest';

import {
  getAvailabilityTagColor,
  getSafetyVerdictColor,
  getSkillInstallStatusDescription,
  getSkillInstallStatusMeta
} from '@/components/chat-message-cards/skill-suggestions-meta';

describe('skill-suggestions-meta', () => {
  it('maps availability and safety verdict colors', () => {
    expect(getAvailabilityTagColor('ready')).toBe('green');
    expect(getAvailabilityTagColor('installable')).toBe('blue');
    expect(getAvailabilityTagColor('installable-local')).toBe('blue');
    expect(getAvailabilityTagColor('installable-remote')).toBe('blue');
    expect(getAvailabilityTagColor('approval-required')).toBe('orange');
    expect(getAvailabilityTagColor('blocked')).toBe('red');

    expect(getSafetyVerdictColor('allow')).toBe('green');
    expect(getSafetyVerdictColor('needs-approval')).toBe('orange');
    expect(getSafetyVerdictColor('deny')).toBe('red');
  });

  it('maps install state metadata and descriptions', () => {
    expect(getSkillInstallStatusMeta({ status: 'requesting' } as any)).toEqual({
      color: 'processing',
      label: '提交中'
    });
    expect(getSkillInstallStatusMeta({ status: 'pending' } as any)).toEqual({ color: 'gold', label: '待审批' });
    expect(getSkillInstallStatusMeta({ status: 'approved' } as any)).toEqual({
      color: 'processing',
      label: '已批准'
    });
    expect(getSkillInstallStatusMeta({ status: 'installing' } as any)).toEqual({
      color: 'processing',
      label: '安装中'
    });
    expect(getSkillInstallStatusMeta({ status: 'installed' } as any)).toEqual({ color: 'green', label: '已安装' });
    expect(getSkillInstallStatusMeta({ status: 'failed' } as any)).toEqual({ color: 'red', label: '安装失败' });
    expect(getSkillInstallStatusMeta({ status: 'rejected' } as any)).toEqual({ color: 'orange', label: '已拒绝' });
    expect(getSkillInstallStatusMeta(undefined)).toBeNull();

    expect(getSkillInstallStatusDescription({ status: 'pending' } as any)).toContain('等待你批准安装');
    expect(getSkillInstallStatusDescription({ status: 'approved' } as any)).toContain('自动继续');
    expect(getSkillInstallStatusDescription({ status: 'installing' } as any)).toContain('自动继续');
    expect(getSkillInstallStatusDescription({ status: 'installed' } as any)).toContain('优先复用');
    expect(getSkillInstallStatusDescription({ status: 'failed' } as any)).toContain('退回现有能力链');
    expect(getSkillInstallStatusDescription({ status: 'rejected' } as any)).toContain('不会自动补齐');
    expect(getSkillInstallStatusDescription({ status: 'requesting' } as any)).toBeUndefined();
  });
});
