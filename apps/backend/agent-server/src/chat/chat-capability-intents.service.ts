import { Injectable } from '@nestjs/common';

import type { AppendChatMessageDto, ChatMessageRecord } from '@agent/core';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { RuntimeSessionService } from '../runtime/services/runtime-session.service';
import { RuntimeSkillCatalogService } from '../runtime/services/runtime-skill-catalog.service';
import { RuntimeToolsService } from '../runtime/services/runtime-tools.service';
import { handleCreateSkillIntent, handleInstallRemoteSkillIntent } from './chat-capability-intents-skills';
import {
  buildSkillCatalogSummary,
  buildToolsCatalogSummary,
  groupSkillCards,
  resolveCapabilityIntent
} from './chat-capability-intents.helpers';
import { handleUseConnectorIntent } from './chat-capability-intents.connector';

@Injectable()
export class ChatCapabilityIntentsService {
  constructor(
    private readonly runtimeSessionService: RuntimeSessionService,
    private readonly runtimeSkillCatalogService: RuntimeSkillCatalogService,
    private readonly runtimeCentersService: RuntimeCentersService,
    private readonly runtimeToolsService: RuntimeToolsService
  ) {}

  async tryHandle(sessionId: string, dto: AppendChatMessageDto): Promise<ChatMessageRecord | undefined> {
    const intent = resolveCapabilityIntent(dto.message);
    if (intent.kind === 'none') {
      return undefined;
    }

    if (intent.kind === 'list-skills') {
      const [skills, bootstrapSkills] = await Promise.all([
        this.runtimeSkillCatalogService.listSkills(),
        this.runtimeSkillCatalogService.listBootstrapSkills()
      ]);
      return this.runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
        role: 'assistant',
        content: buildSkillCatalogSummary(skills.length, bootstrapSkills.length),
        card: {
          type: 'capability_catalog',
          title: '当前 Skills',
          summary: '按 Bootstrap、归属层和当前治理状态整理。',
          groups: [
            {
              key: 'bootstrap',
              label: 'Bootstrap Skills',
              kind: 'skill',
              items: bootstrapSkills.map(skill => ({
                id: skill.id,
                displayName: skill.displayName,
                summary: skill.description,
                ownerType: 'shared',
                scope: 'session',
                bootstrap: true,
                enabled: true,
                status: 'active'
              }))
            },
            ...groupSkillCards(skills)
          ]
        }
      });
    }

    if (intent.kind === 'list-tools') {
      const toolsCenter = this.runtimeToolsService.getToolsCenter();
      return this.runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
        role: 'assistant',
        content: buildToolsCatalogSummary(toolsCenter),
        card: {
          type: 'capability_catalog',
          title: '当前 Tools',
          summary: '按 tool family、归属和治理状态整理，便于解释为什么会被建议、被调用或被阻塞。',
          groups: toolsCenter.families.map((family: any) => ({
            key: family.id,
            label: family.displayName,
            kind: 'tool',
            items: toolsCenter.tools
              .filter((tool: any) => tool.family === family.id)
              .map((tool: any) => ({
                id: tool.name,
                displayName: tool.name,
                summary: tool.description,
                ownerType: tool.ownerType,
                ownerId: tool.ownerId,
                bootstrap: tool.bootstrap,
                enabled: true,
                status: tool.requiresApproval ? 'approval-sensitive' : 'ready',
                family: tool.family,
                capabilityType: tool.capabilityType,
                preferredMinistries: tool.preferredMinistries
              }))
          }))
        }
      });
    }

    if (intent.kind === 'list-connectors') {
      const connectors = await this.runtimeToolsService.listConnectors();
      return this.runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
        role: 'assistant',
        content: connectors.length
          ? `当前有 ${connectors.length} 个可观测的 MCP / connector。`
          : '当前还没有可用的 MCP / connector。',
        card: {
          type: 'capability_catalog',
          title: '当前 MCP / Connectors',
          summary: '按已配置和模板建议整理，可继续用自然语言指定 Browser / GitHub / Lark MCP。',
          groups: [
            {
              key: 'configured-connectors',
              label: 'Configured Connectors',
              kind: 'connector',
              items: connectors.map(connector => ({
                id: connector.id,
                displayName: connector.displayName,
                summary:
                  connector.healthReason ??
                  `${connector.capabilityCount} capabilities · ${connector.transport} · ${connector.source}`,
                ownerType: connector.configurationTemplateId ? 'user-attached' : 'shared',
                scope: 'workspace',
                enabled: connector.enabled,
                status: connector.healthState
              }))
            }
          ]
        }
      });
    }

    if (intent.kind === 'list-capabilities') {
      const [skills, bootstrapSkills, connectors] = await Promise.all([
        this.runtimeSkillCatalogService.listSkills(),
        this.runtimeSkillCatalogService.listBootstrapSkills(),
        this.runtimeToolsService.listConnectors()
      ]);
      const toolsCenter = this.runtimeToolsService.getToolsCenter();
      return this.runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
        role: 'assistant',
        content: `当前会话能力池可见 ${toolsCenter.totalTools} 个 tools、${skills.length + bootstrapSkills.length} 个 skills、${connectors.length} 个 connectors / MCP。`,
        card: {
          type: 'capability_catalog',
          title: '当前 Tools / Skills / MCP',
          summary: '统一按工具、技能和连接器归组，便于继续追问谁在用、为什么建议、为什么阻塞。',
          groups: [
            {
              key: 'tools',
              label: 'Tools',
              kind: 'tool',
              items: toolsCenter.tools.slice(0, 12).map((tool: any) => ({
                id: tool.name,
                displayName: tool.name,
                summary: tool.description,
                ownerType: tool.ownerType,
                ownerId: tool.ownerId,
                bootstrap: tool.bootstrap,
                enabled: true,
                status: tool.requiresApproval ? 'approval-sensitive' : 'ready',
                family: tool.family,
                capabilityType: tool.capabilityType,
                preferredMinistries: tool.preferredMinistries
              }))
            },
            {
              key: 'skills',
              label: 'Skills',
              kind: 'skill',
              items: [
                ...bootstrapSkills.map((skill: any) => ({
                  id: skill.id,
                  displayName: skill.displayName,
                  summary: skill.description,
                  ownerType: 'shared',
                  scope: 'session',
                  bootstrap: true,
                  enabled: true,
                  status: 'active'
                })),
                ...groupSkillCards(skills).flatMap(group => group.items)
              ].slice(0, 12)
            },
            {
              key: 'connectors',
              label: 'Connectors / MCP',
              kind: 'connector',
              items: connectors.slice(0, 12).map((connector: any) => ({
                id: connector.id,
                displayName: connector.displayName,
                summary:
                  connector.healthReason ??
                  `${connector.capabilityCount} capabilities · ${connector.transport} · ${connector.source}`,
                ownerType: connector.configurationTemplateId ? 'user-attached' : 'shared',
                scope: 'workspace',
                enabled: connector.enabled,
                status: connector.healthState
              }))
            }
          ]
        }
      });
    }

    if (intent.kind === 'create-skill') {
      return handleCreateSkillIntent({
        sessionId,
        dto,
        intent,
        runtimeSkillCatalogService: this.runtimeSkillCatalogService,
        runtimeSessionService: this.runtimeSessionService
      });
    }

    if (intent.kind === 'install-skill') {
      return handleInstallRemoteSkillIntent({
        sessionId,
        dto,
        intent,
        runtimeCentersService: this.runtimeCentersService,
        runtimeSessionService: this.runtimeSessionService
      });
    }

    if (intent.kind === 'use-connector') {
      return handleUseConnectorIntent({
        sessionId,
        dto,
        intent,
        runtimeToolsService: this.runtimeToolsService,
        runtimeSessionService: this.runtimeSessionService
      });
    }

    return undefined;
  }
}
