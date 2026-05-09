import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { IdentityUserService } from '../../domains/identity/services/identity-user.service';

@Controller('identity/users')
export class IdentityUsersController {
  constructor(private readonly identityUserService: IdentityUserService) {}

  @Get()
  listUsers() {
    return this.identityUserService.listUsers();
  }

  @Post()
  createUser(@Body() body: unknown) {
    return this.identityUserService.createUser(body as never);
  }

  @Patch(':userId/disable')
  disableUser(@Param('userId') userId: string) {
    return this.identityUserService.disableUser(userId);
  }

  @Patch(':userId/enable')
  enableUser(@Param('userId') userId: string) {
    return this.identityUserService.enableUser(userId);
  }
}
