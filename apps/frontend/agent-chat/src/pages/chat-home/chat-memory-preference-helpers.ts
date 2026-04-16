import type { PatchUserProfileDto } from '@agent/shared';

import type { ChatCheckpointRecord } from '@/types/chat';

type MemoryEvidenceRecord = NonNullable<ChatCheckpointRecord['externalSources']>[number];

const PROFILE_FIELD_ALIASES = {
  communicationStyle: ['communicationstyle', 'communication', '沟通', '表达', '回复风格'],
  executionStyle: ['executionstyle', 'execution', '执行', '推进', '先做', '先解释'],
  approvalStyle: ['approvalstyle', 'approval', '审批'],
  riskTolerance: ['risktolerance', 'risk', '风险'],
  codingPreferences: ['codingpreferences', 'coding', '代码', '语言', 'framework', '测试'],
  doNotDo: ['donotdo', 'forbid', 'forbidden', '禁止', '不要', '别', '不能'],
  privacyFlags: ['privacyflags', 'privacy', '隐私']
} satisfies Record<string, string[]>;

type PreferenceField = keyof Pick<
  PatchUserProfileDto,
  | 'communicationStyle'
  | 'executionStyle'
  | 'approvalStyle'
  | 'riskTolerance'
  | 'codingPreferences'
  | 'doNotDo'
  | 'privacyFlags'
>;

export function buildProfilePatchFromPreferenceUpdate(
  source: MemoryEvidenceRecord,
  rawInput: string
): PatchUserProfileDto | null {
  const normalizedInput = rawInput.trim();
  if (!normalizedInput) {
    return null;
  }

  const explicit = parseExplicitFieldValue(normalizedInput);
  if (explicit) {
    return explicit;
  }

  const inferredField = inferPreferenceField(source);
  if (!inferredField) {
    return null;
  }

  return toProfilePatch(inferredField, normalizedInput);
}

export function inferPreferenceField(source: MemoryEvidenceRecord): PreferenceField | null {
  const tags = Array.isArray(source.detail?.tags)
    ? source.detail.tags.filter((item): item is string => typeof item === 'string')
    : [];
  const candidates = [
    source.summary.replace(/^已命中历史记忆：/, '').trim(),
    ...(typeof source.detail?.reason === 'string' ? [source.detail.reason] : []),
    ...tags
  ]
    .join(' ')
    .toLowerCase();

  if (!candidates) {
    return null;
  }

  for (const [field, aliases] of Object.entries(PROFILE_FIELD_ALIASES) as Array<[PreferenceField, string[]]>) {
    if (aliases.some(alias => candidates.includes(alias))) {
      return field;
    }
  }

  if (/不要|禁止|never|avoid|must not/i.test(candidates)) {
    return 'doNotDo';
  }
  if (/rust|typescript|python|go|java|test|lint|format/i.test(candidates)) {
    return 'codingPreferences';
  }
  return null;
}

function parseExplicitFieldValue(rawInput: string): PatchUserProfileDto | null {
  const separatorIndex = rawInput.search(/[:：]/);
  if (separatorIndex <= 0) {
    return null;
  }

  const rawField = rawInput.slice(0, separatorIndex).trim().toLowerCase();
  const rawValue = rawInput.slice(separatorIndex + 1).trim();
  if (!rawField || !rawValue) {
    return null;
  }

  const field = (Object.entries(PROFILE_FIELD_ALIASES) as Array<[PreferenceField, string[]]>).find(([, aliases]) =>
    aliases.some(alias => alias === rawField)
  )?.[0];

  return field ? toProfilePatch(field, rawValue) : null;
}

function toProfilePatch(field: PreferenceField, value: string): PatchUserProfileDto {
  if (field === 'codingPreferences' || field === 'doNotDo' || field === 'privacyFlags') {
    return {
      [field]: value
        .split(/[，,]/)
        .map(item => item.trim())
        .filter(Boolean)
    } as PatchUserProfileDto;
  }

  return {
    [field]: value
  } as PatchUserProfileDto;
}
