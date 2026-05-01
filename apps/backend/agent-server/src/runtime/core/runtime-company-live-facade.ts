import { Injectable } from '@nestjs/common';

import type { CompanyLiveContentBrief, CompanyLiveGenerateResult } from '@agent/core';
import {
  createCompanyLiveStubRegistry,
  executeCompanyLiveGraph,
  type CompanyLiveGraphOptions
} from '@agent/agents-company-live';

@Injectable()
export class RuntimeCompanyLiveFacade {
  async generate(
    brief: CompanyLiveContentBrief,
    options?: CompanyLiveGraphOptions
  ): Promise<CompanyLiveGenerateResult> {
    const registry = createCompanyLiveStubRegistry();
    return executeCompanyLiveGraph(brief, registry, options);
  }
}
