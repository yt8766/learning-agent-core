import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health(): { service: 'knowledge-server'; status: 'ok' } {
    return { service: 'knowledge-server', status: 'ok' };
  }
}
