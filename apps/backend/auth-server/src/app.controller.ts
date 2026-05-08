import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health(): { service: 'auth-server'; status: 'ok' } {
    return { service: 'auth-server', status: 'ok' };
  }
}
