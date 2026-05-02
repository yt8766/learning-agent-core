import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUserCreateRequestSchema, type AuthAccount, type AuthUsersListResponse } from '@agent/core';

import { UserManagementService } from './user-management.service';

@Controller('auth/users')
export class UserManagementController {
  constructor(private readonly users: UserManagementService) {}

  @Get()
  listUsers(): Promise<AuthUsersListResponse> {
    return this.users.listUsers();
  }

  @Post()
  createUser(@Body() body: unknown): Promise<AuthAccount> {
    return this.users.createUser(AuthUserCreateRequestSchema.parse(body));
  }

  @Post(':userId/disable')
  disableUser(@Param('userId') userId: string): Promise<AuthAccount> {
    return this.users.disableUser(userId);
  }

  @Post(':userId/enable')
  enableUser(@Param('userId') userId: string): Promise<AuthAccount> {
    return this.users.enableUser(userId);
  }
}
