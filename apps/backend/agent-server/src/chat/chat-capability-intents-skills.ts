import type { AppendChatMessageDto, ChatMessageRecord } from '@agent/core';

export async function handleCreateSkillIntent(input: {
  sessionId: string;
  dto: AppendChatMessageDto;
  intent: { description: string; displayName?: string };
  runtimeSkillCatalogService: {
    createUserSkillDraft: (params: { prompt: string; displayName?: string; sessionId: string }) => Promise<any>;
  };
  runtimeSessionService: {
    attachSessionCapabilities: (sessionId: string, payload: any) => Promise<unknown>;
    appendInlineCapabilityResponse: (
      sessionId: string,
      dto: AppendChatMessageDto,
      payload: any
    ) => Promise<ChatMessageRecord>;
  };
}): Promise<ChatMessageRecord> {
  const { sessionId, dto, intent, runtimeSkillCatalogService, runtimeSessionService } = input;

  const created = await runtimeSkillCatalogService.createUserSkillDraft({
    prompt: intent.description,
    displayName: intent.displayName,
    sessionId
  });
  await runtimeSessionService.attachSessionCapabilities(sessionId, {
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
          steps: (created.steps ?? []).map((step: any) => ({
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
  return runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
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

export async function handleInstallRemoteSkillIntent(input: {
  sessionId: string;
  dto: AppendChatMessageDto;
  intent: { repo: string; skillName?: string };
  runtimeCentersService: {
    installRemoteSkill: (params: {
      repo: string;
      skillName?: string;
      actor?: string;
      triggerReason?: string;
      summary?: string;
    }) => Promise<any>;
  };
  runtimeSessionService: {
    appendInlineCapabilityResponse: (
      sessionId: string,
      dto: AppendChatMessageDto,
      payload: any
    ) => Promise<ChatMessageRecord>;
  };
}): Promise<ChatMessageRecord> {
  const { sessionId, dto, intent, runtimeCentersService, runtimeSessionService } = input;

  const receipt = await runtimeCentersService.installRemoteSkill({
    repo: intent.repo,
    skillName: intent.skillName,
    actor: 'agent-chat-user',
    triggerReason: 'user_requested',
    summary: `用户通过自然语言请求安装远程 skill ${intent.skillName ?? intent.repo}`
  });

  const installName = receipt.skillName ?? intent.skillName ?? intent.repo;
  const statusMeta = resolveRemoteSkillInstallStatusMeta(receipt.status);
  const failureDetail =
    typeof receipt.failureCode === 'string' && receipt.failureCode.trim() ? receipt.failureCode.trim() : undefined;
  const summary =
    receipt.status === 'installed'
      ? `${installName} 已安装完成，当前会话后续可以直接复用。`
      : receipt.status === 'failed'
        ? `${installName} 安装失败。${failureDetail ? `失败原因：${failureDetail}` : ''}`.trim()
        : `${installName} 已发起安装，当前状态：${statusMeta.label}。`;

  return runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
    role: 'assistant',
    content: summary,
    card: {
      type: 'capability_catalog',
      title: statusMeta.title,
      summary,
      groups: [
        {
          key: 'remote-skill-install',
          label: 'Remote Skill Install',
          kind: 'skill',
          items: [
            {
              id: receipt.skillId ?? intent.repo,
              displayName: installName,
              summary: receipt.repo ?? intent.repo,
              ownerType: 'runtime-derived',
              scope: 'workspace',
              enabled: receipt.status === 'installed',
              status: statusMeta.itemStatus,
              blockedReason: failureDetail
            }
          ]
        }
      ]
    }
  });
}

export function resolveRemoteSkillInstallStatusMeta(status?: string) {
  switch (status) {
    case 'installed':
      return {
        title: 'Skill 已安装',
        label: 'installed',
        itemStatus: 'active'
      };
    case 'failed':
      return {
        title: 'Skill 安装失败',
        label: 'failed',
        itemStatus: 'failed'
      };
    case 'rejected':
      return {
        title: 'Skill 已拒绝',
        label: 'rejected',
        itemStatus: 'rejected'
      };
    case 'pending':
      return {
        title: 'Skill 待审批',
        label: 'pending',
        itemStatus: 'approval-sensitive'
      };
    case 'approved':
      return {
        title: 'Skill 安装中',
        label: 'approved',
        itemStatus: 'installing'
      };
    default:
      return {
        title: 'Skill 安装中',
        label: status ?? 'installing',
        itemStatus: status ?? 'installing'
      };
  }
}
