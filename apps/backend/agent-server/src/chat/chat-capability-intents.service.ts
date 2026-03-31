import { Injectable } from '@nestjs/common';

import type { AppendChatMessageDto, ChatMessageRecord } from '@agent/shared';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { RuntimeSessionService } from '../runtime/services/runtime-session.service';
import { RuntimeSkillCatalogService } from '../runtime/services/runtime-skill-catalog.service';
import { RuntimeToolsService } from '../runtime/services/runtime-tools.service';
import { buildSkillCatalogSummary, groupSkillCards, resolveCapabilityIntent } from './chat-capability-intents.helpers';
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
        content:
          toolsCenter.totalTools > 0
            ? `当前可见 ${toolsCenter.totalTools} 个 tools，分布在 ${toolsCenter.familyCount} 个 family。`
            : '当前还没有可见 tools。',
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
      const created = await this.runtimeSkillCatalogService.createUserSkillDraft({
        prompt: intent.description,
        displayName: intent.displayName,
        sessionId
      });
      await this.runtimeSessionService.attachSessionCapabilities(sessionId, {
        attachments: [
          {
            id: `user-skill:${created.id}`,
            displayName: created.name,
            kind: 'skill',
            owner: created.ownership ?? {
              ownerType: 'user-attached',
              ownerId: `session:${sessionId}`,
              capabilityType: 'skill',
              scope: 'workspace',
              trigger: 'user_requested'
            },
            enabled: true,
            sourceId: created.id,
            metadata: {
              steps: (created.steps ?? []).map(step => ({
                title: step.title,
                instruction: step.instruction,
                toolNames: step.toolNames
              })),
              requiredTools: created.toolContract?.required ?? created.requiredTools,
              optionalTools: created.toolContract?.optional ?? [],
              approvalSensitiveTools: created.toolContract?.approvalSensitive ?? [],
              preferredConnectors: created.connectorContract?.preferred ?? created.preferredConnectors ?? [],
              requiredConnectors: created.connectorContract?.required ?? created.requiredConnectors ?? []
            },
            createdAt: created.createdAt,
            updatedAt: created.updatedAt
          }
        ],
        augmentations: [
          {
            id: `user-skill-ready:${created.id}`,
            kind: 'skill',
            status: 'ready',
            requestedBy: 'user',
            target: created.id,
            reason: `${created.name} 已作为当前会话可直接复用的个人 skill 启用。`,
            owner: created.ownership ?? {
              ownerType: 'user-attached',
              ownerId: `session:${sessionId}`,
              capabilityType: 'skill',
              scope: 'workspace',
              trigger: 'user_requested'
            },
            summary: created.description,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt
          }
        ],
        usedInstalledSkills: [`installed-skill:${created.id}`]
      });
      return this.runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
        role: 'assistant',
        content: `${created.name} 已创建为 Skill Draft，已发布到 Skill Lab 并默认启用，当前会话后续可以继续复用它。`,
        card: {
          type: 'skill_draft_created',
          skillId: created.id,
          displayName: created.name,
          description: created.description,
          ownerType: created.ownership?.ownerType ?? 'user-attached',
          scope: created.ownership?.scope ?? 'workspace',
          status: created.status,
          enabled: created.status !== 'disabled',
          contract: {
            requiredTools: created.toolContract?.required ?? created.requiredTools,
            optionalTools: created.toolContract?.optional ?? [],
            approvalSensitiveTools: created.toolContract?.approvalSensitive ?? [],
            preferredConnectors: created.connectorContract?.preferred ?? created.preferredConnectors ?? [],
            requiredConnectors: created.connectorContract?.required ?? []
          },
          nextActions: [
            '继续在当前会话里直接调用这个 skill',
            '去 agent-admin 的 Skill Lab 查看和编辑草稿',
            '复用次数足够后再提升为 shared / ministry-owned / specialist-owned'
          ]
        }
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
