import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUserCreateRequestSchema, type AuthAccount, type AuthUsersListResponse } from '@agent/core';

import { AuthGuard } from './auth.guard';
import { AuthAdminGuard } from './guards/auth-admin.guard';
import { UserManagementService } from './user-management.service';

@UseGuards(AuthGuard, AuthAdminGuard)
@Controller('auth/users')
export class UserManagementController {
  constructor(@Inject(UserManagementService) private readonly users: UserManagementService) {}

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
