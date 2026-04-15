import type { DataReportJsonPatchIntent } from '../../../types/data-report-json';

export function hasIntent(
  intents: DataReportJsonPatchIntent[] | undefined,
  target: DataReportJsonPatchIntent['target'],
  action?: DataReportJsonPatchIntent['action']
) {
  if (!intents?.length) {
    return false;
  }

  return intents.some(intent => intent.target === target && (!action || intent.action === action));
}

export function getIntentSubjects(
  intents: DataReportJsonPatchIntent[] | undefined,
  target: DataReportJsonPatchIntent['target'],
  action: DataReportJsonPatchIntent['action']
) {
  return (intents ?? [])
    .filter(intent => intent.target === target && intent.action === action)
    .map(intent => intent.subject?.trim())
    .filter((subject): subject is string => Boolean(subject));
}
