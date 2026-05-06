import { BadRequestException, Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  KnowledgeApiKeyCreateRequestSchema,
  KnowledgeAssistantConfigPatchRequestSchema,
  KnowledgeSecuritySettingsPatchRequestSchema,
  KnowledgeWorkspaceInvitationCreateRequestSchema
} from '@agent/core';
import { ZodError } from 'zod';

import { AuthGuard } from '../auth/auth.guard';
import { KnowledgeFrontendSettingsService } from './knowledge-frontend-settings.service';

@UseGuards(AuthGuard)
@Controller('knowledge')
export class KnowledgeFrontendSettingsController {
  constructor(private readonly settings: KnowledgeFrontendSettingsService) {}

  @Get('workspace/users')
  listWorkspaceUsers(@Query() query: Record<string, string | undefined> = {}) {
    return this.settings.listWorkspaceUsers(query);
  }

  @Post('workspace/users/invitations')
  createWorkspaceInvitation(@Body() body: unknown) {
    try {
      return this.settings.createWorkspaceInvitation(KnowledgeWorkspaceInvitationCreateRequestSchema.parse(body));
    } catch (error) {
      throw toValidationException(error);
    }
  }

  @Get('settings/model-providers')
  listModelProviders() {
    return this.settings.listModelProviders();
  }

  @Get('settings/api-keys')
  listApiKeys() {
    return this.settings.listApiKeys();
  }

  @Post('settings/api-keys')
  createApiKey(@Body() body: unknown) {
    try {
      return this.settings.createApiKey(KnowledgeApiKeyCreateRequestSchema.parse(body));
    } catch (error) {
      throw toValidationException(error);
    }
  }

  @Get('settings/storage')
  listStorageSettings() {
    return this.settings.listStorageSettings();
  }

  @Get('settings/security')
  getSecuritySettings() {
    return this.settings.getSecuritySettings();
  }

  @Patch('settings/security')
  patchSecuritySettings(@Body() body: unknown) {
    try {
      return this.settings.patchSecuritySettings(KnowledgeSecuritySettingsPatchRequestSchema.parse(body));
    } catch (error) {
      throw toValidationException(error);
    }
  }

  @Get('chat/assistant-config')
  getAssistantConfig() {
    return this.settings.getAssistantConfig();
  }

  @Patch('chat/assistant-config')
  patchAssistantConfig(@Body() body: unknown) {
    try {
      return this.settings.patchAssistantConfig(KnowledgeAssistantConfigPatchRequestSchema.parse(body));
    } catch (error) {
      throw toValidationException(error);
    }
  }
}

function toValidationException(error: unknown): BadRequestException {
  if (error instanceof ZodError) {
    return new BadRequestException({
      code: 'validation_error',
      message: 'Request body does not match the Knowledge API contract.',
      details: {
        fields: Object.fromEntries(error.issues.map(issue => [issue.path.join('.'), issue.message]))
      }
    });
  }
  throw error;
}
