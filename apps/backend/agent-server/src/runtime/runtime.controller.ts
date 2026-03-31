import { Controller, Get } from '@nestjs/common';

import { RuntimeArchitectureService } from './architecture/runtime-architecture.service';

@Controller('runtime')
export class RuntimeController {
  constructor(private readonly runtimeArchitectureService: RuntimeArchitectureService) {}

  @Get('architecture')
  getArchitecture() {
    return this.runtimeArchitectureService.getArchitecture();
  }
}
