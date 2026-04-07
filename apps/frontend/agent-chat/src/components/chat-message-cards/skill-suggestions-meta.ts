import type { ChatMessageRecord } from '@/types/chat';

export function getAvailabilityTagColor(availability: string) {
  if (availability === 'ready') {
    return 'green';
  }
  if (availability === 'installable' || availability === 'installable-local' || availability === 'installable-remote') {
    return 'blue';
  }
  if (availability === 'approval-required') {
    return 'orange';
  }
  return 'red';
}

export function getSafetyVerdictColor(verdict: string) {
  if (verdict === 'allow') {
    return 'green';
  }
  if (verdict === 'needs-approval') {
    return 'orange';
  }
  return 'red';
}

export function getSkillInstallStatusMeta(
  state?: Extract<
    NonNullable<ChatMessageRecord['card']>,
    { type: 'skill_suggestions' }
  >['suggestions'][number]['installState']
) {
  switch (state?.status) {
    case 'requesting':
      return { color: 'processing' as const, label: '提交中' };
    case 'pending':
      return { color: 'gold' as const, label: '待审批' };
    case 'approved':
      return { color: 'processing' as const, label: '已批准' };
    case 'installing':
      return { color: 'processing' as const, label: '安装中' };
    case 'installed':
      return { color: 'green' as const, label: '已安装' };
    case 'failed':
      return { color: 'red' as const, label: '安装失败' };
    case 'rejected':
      return { color: 'orange' as const, label: '已拒绝' };
    default:
      return null;
  }
}

export function getSkillInstallStatusDescription(
  state?: Extract<
    NonNullable<ChatMessageRecord['card']>,
    { type: 'skill_suggestions' }
  >['suggestions'][number]['installState']
) {
  switch (state?.status) {
    case 'pending':
      return '当前轮已经暂停，等待你批准安装后继续执行。';
    case 'approved':
    case 'installing':
      return '当前轮正在补齐该 skill，安装完成后会自动继续。';
    case 'installed':
      return '该 skill 已装入当前能力链，后续当前轮会优先复用。';
    case 'failed':
      return '安装没有完成，当前轮会退回现有能力链。';
    case 'rejected':
      return '本次安装已被拒绝，当前轮不会自动补齐这个 skill。';
    default:
      return undefined;
  }
}
