import { BadRequestException, Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import {
  KnowledgeApiKeyCreateRequestSchema,
  KnowledgeAssistantConfigPatchRequestSchema,
  KnowledgeSecuritySettingsPatchRequestSchema,
  KnowledgeWorkspaceInvitationCreateRequestSchema
} from '@agent/core';
import { ZodError } from 'zod';

import { KnowledgeFrontendSettingsService } from '../../domains/knowledge/services/knowledge-frontend-settings.service';

@Controller('knowledge/workspace')
export class KnowledgeWorkspaceController {
  constructor(private readonly settings: KnowledgeFrontendSettingsService) {}

  @Get('users')
  listWorkspaceUsers(@Query() query: Record<string, string | undefined> = {}) {
    return this.settings.listWorkspaceUsers(query);
  }

  @Post('users/invitations')
  createWorkspaceInvitation(@Body() body: unknown) {
    try {
      return this.settings.createWorkspaceInvitation(KnowledgeWorkspaceInvitationCreateRequestSchema.parse(body));
    } catch (error) {
      throw toValidationException(error);
    }
  }
}

@Controller('knowledge/settings')
export class KnowledgeSettingsController {
  constructor(private readonly settings: KnowledgeFrontendSettingsService) {}

  @Get('model-providers')
  listModelProviders() {
    return this.settings.listModelProviders();
  }

  @Get('api-keys')
  listApiKeys() {
    return this.settings.listApiKeys();
  }

  @Post('api-keys')
  createApiKey(@Body() body: unknown) {
    try {
      return this.settings.createApiKey(KnowledgeApiKeyCreateRequestSchema.parse(body));
    } catch (error) {
      throw toValidationException(error);
    }
  }

  @Get('storage')
  listStorageSettings() {
    return this.settings.listStorageSettings();
  }

  @Get('security')
  getSecuritySettings() {
    return this.settings.getSecuritySettings();
  }

  @Patch('security')
  patchSecuritySettings(@Body() body: unknown) {
    try {
      return this.settings.patchSecuritySettings(KnowledgeSecuritySettingsPatchRequestSchema.parse(body));
    } catch (error) {
      throw toValidationException(error);
    }
  }
}

@Controller('knowledge/chat')
export class KnowledgeChatSettingsController {
  constructor(private readonly settings: KnowledgeFrontendSettingsService) {}

  @Get('assistant-config')
  getAssistantConfig() {
    return this.settings.getAssistantConfig();
  }

  @Patch('assistant-config')
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
