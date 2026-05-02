import { Injectable, Optional } from '@nestjs/common';

import type { CompanyExpertConsultation, CompanyLiveContentBrief, CompanyLiveGenerateResult } from '@agent/core';
import {
  consultCompanyLiveExperts,
  createCompanyLiveStubRegistry,
  executeCompanyLiveGraph,
  type CompanyLiveExpertConsultOptions,
  type CompanyLiveGraphOptions
} from '@agent/agents-company-live';
import { RuntimeHost } from './runtime.host';

@Injectable()
export class RuntimeCompanyLiveFacade {
  constructor(@Optional() private readonly runtimeHost?: Pick<RuntimeHost, 'llmProvider'>) {}

  async generate(
    brief: CompanyLiveContentBrief,
    options?: CompanyLiveGraphOptions
  ): Promise<CompanyLiveGenerateResult> {
    const registry = createCompanyLiveStubRegistry();
    return executeCompanyLiveGraph(brief, registry, options);
  }

  async consultExperts(params: CompanyLiveExpertConsultOptions): Promise<CompanyExpertConsultation> {
    return consultCompanyLiveExperts({
      ...params,
      llm: params.llm ?? this.runtimeHost?.llmProvider
    });
  }
}
