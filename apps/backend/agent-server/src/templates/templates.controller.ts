import { Controller, Get, Param } from '@nestjs/common';

import { TemplatesService } from './templates.service';

@Controller('template')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get('react-ts')
  getReactTsTemplate() {
    return this.templatesService.getReactTsTemplate();
  }

  @Get('templates/:id')
  getTemplateById(@Param('id') templateId: string) {
    return this.templatesService.getTemplate(templateId);
  }
}
