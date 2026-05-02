import { Injectable } from '@nestjs/common';

import type { CompanyExpertConsultation, CompanyLiveGenerateResult } from '@agent/core';

import { RuntimeCompanyLiveFacade } from '../runtime/core/runtime-company-live-facade';
import type { CompanyLiveGenerateDto } from './company-live.dto';

@Injectable()
export class CompanyLiveService {
  constructor(private readonly companyLiveFacade: RuntimeCompanyLiveFacade) {}

  async generate(dto: CompanyLiveGenerateDto): Promise<CompanyLiveGenerateResult> {
    return this.companyLiveFacade.generate(dto);
  }

  async consultExperts(dto: CompanyLiveGenerateDto, question: string): Promise<CompanyExpertConsultation> {
    return this.companyLiveFacade.consultExperts({ brief: dto, question });
  }
}
