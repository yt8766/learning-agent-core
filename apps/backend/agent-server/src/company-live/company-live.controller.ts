import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import type { CompanyExpertConsultation, CompanyLiveGenerateResult } from '@agent/core';

import { CompanyLiveService } from './company-live.service';
import { parseCompanyLiveExpertConsultDto, parseCompanyLiveGenerateDto } from './company-live.dto';

@Controller('company-live')
export class CompanyLiveController {
  constructor(private readonly companyLiveService: CompanyLiveService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(@Body() body: unknown): Promise<CompanyLiveGenerateResult> {
    const brief = parseCompanyLiveGenerateDto(body);
    return this.companyLiveService.generate(brief);
  }

  @Post('experts/consult')
  @HttpCode(HttpStatus.OK)
  async consultExperts(@Body() body: unknown): Promise<CompanyExpertConsultation> {
    const { brief, question } = parseCompanyLiveExpertConsultDto(body);
    return this.companyLiveService.consultExperts(brief, question);
  }
}
