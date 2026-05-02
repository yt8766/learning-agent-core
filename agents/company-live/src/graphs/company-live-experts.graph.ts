import type { CompanyExpertConsultation } from '@agent/core';

import {
  runCompanyLiveExpertConsultation,
  type CompanyLiveExpertConsultInput
} from '../flows/company-live/nodes/expert-consultation-nodes';

export type CompanyLiveExpertConsultOptions = CompanyLiveExpertConsultInput;

export async function consultCompanyLiveExperts(
  input: CompanyLiveExpertConsultOptions
): Promise<CompanyExpertConsultation> {
  return runCompanyLiveExpertConsultation(input);
}
