import type { TaskRecord as CoreTaskRecord } from '@agent/core';

import type { RuntimeApprovalInterruptRecord } from './runtime-approval.types';
import type {
  RuntimeSpecialistFindingRecord,
  RuntimeSpecialistLeadRecord,
  RuntimeSpecialistSupportRecord
} from './runtime-specialist-finding.types';

export type RuntimeTaskRecord = Omit<
  CoreTaskRecord,
  'activeInterrupt' | 'interruptHistory' | 'specialistLead' | 'supportingSpecialists' | 'specialistFindings'
> & {
  activeInterrupt?: RuntimeApprovalInterruptRecord;
  interruptHistory?: RuntimeApprovalInterruptRecord[];
  specialistLead?: RuntimeSpecialistLeadRecord;
  supportingSpecialists?: RuntimeSpecialistSupportRecord[];
  specialistFindings?: RuntimeSpecialistFindingRecord[];
};
