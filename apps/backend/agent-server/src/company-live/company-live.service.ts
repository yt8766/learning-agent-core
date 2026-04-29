import { Injectable } from '@nestjs/common';

import type { CompanyLiveGenerateResult } from '@agent/core';
import { createCompanyLiveStubRegistry, executeCompanyLiveGraph } from '@agent/agents-company-live';

import type { CompanyLiveGenerateDto } from './company-live.dto';

@Injectable()
export class CompanyLiveService {
  async generate(dto: CompanyLiveGenerateDto): Promise<CompanyLiveGenerateResult> {
    const registry = createCompanyLiveStubRegistry();
    return executeCompanyLiveGraph(dto, registry);
  }
}
