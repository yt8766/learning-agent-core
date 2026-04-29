import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import type { CompanyLiveGenerateResult } from '@agent/core';

import { CompanyLiveService } from './company-live.service';
import { parseCompanyLiveGenerateDto } from './company-live.dto';

@Controller('company-live')
export class CompanyLiveController {
  constructor(private readonly companyLiveService: CompanyLiveService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(@Body() body: unknown): Promise<CompanyLiveGenerateResult> {
    const brief = parseCompanyLiveGenerateDto(body);
    return this.companyLiveService.generate(brief);
  }
}
