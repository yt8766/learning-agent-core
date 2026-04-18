import type { AppendChatMessageDto, ChatMessageRecord } from '@agent/core';

import { buildDefaultConnectorConfig, buildTemplatePlaceholder } from './chat-capability-intents.helpers';

export async function handleUseConnectorIntent(input: {
  sessionId: string;
  dto: AppendChatMessageDto;
  intent: {
    connectorQuery: string;
    label: string;
    templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  };
  runtimeToolsService: {
    listConnectors: () => Promise<any[]>;
    configureConnector: (dto: any) => Promise<any>;
  };
  runtimeSessionService: {
    attachSessionCapabilities: (sessionId: string, payload: any) => Promise<unknown>;
    appendInlineCapabilityResponse: (
      sessionId: string,
      dto: AppendChatMessageDto,
      payload: any
    ) => Promise<ChatMessageRecord>;
  };
}) {
  const { sessionId, dto, intent, runtimeToolsService, runtimeSessionService } = input;
  const connectors = await runtimeToolsService.listConnectors();
  const matched = connectors.filter((connector: any) =>
    `${connector.displayName} ${connector.id}`.toLowerCase().includes(intent.connectorQuery)
  );

  if (!matched.length) {
    const configured = await runtimeToolsService.configureConnector(
      buildDefaultConnectorConfig(intent.templateId, dto.message)
    );
    const isDraft = intent.templateId === 'lark-mcp-template' && !configured.enabled;
    await runtimeSessionService.attachSessionCapabilities(sessionId, {
      attachments: [
        {
          id: `user-connector:${configured.id}`,
          displayName: configured.displayName,
          kind: 'connector',
          owner: {
            ownerType: 'user-attached',
            ownerId: `session:${sessionId}`,
            capabilityType: 'connector',
            scope: 'workspace',
            trigger: 'user_requested'
          },
          enabled: configured.enabled,
          sourceId: configured.id,
          createdAt: configured.configuredAt,
          updatedAt: configured.configuredAt
        }
      ],
      augmentations: [
        {
          id: `user-connector-ready:${configured.id}`,
          kind: 'connector',
          status: configured.enabled ? 'ready' : 'configuring',
          requestedBy: 'user',
          target: configured.id,
          reason: isDraft
            ? `${intent.label} 已进入当前会话能力池，等待补齐配置。`
            : `${intent.label} 已接入当前会话能力池。`,
          owner: {
            ownerType: 'user-attached',
            ownerId: `session:${sessionId}`,
            capabilityType: 'connector',
            scope: 'workspace',
            trigger: 'user_requested'
          },
          summary: configured.displayName,
          createdAt: configured.configuredAt,
          updatedAt: configured.configuredAt
        }
      ]
    });
    return runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
      role: 'assistant',
      content: isDraft
        ? `${intent.label} 已生成配置草稿，但当前缺少 endpoint 或 token，所以先以 disabled draft 进入能力池。补齐配置后，本会话可以继续优先使用它。`
        : `${intent.label} 已按默认安全配置接入，当前会话后续可以继续明确要求优先使用它。`,
      card: {
        type: 'capability_catalog',
        title: isDraft ? `${intent.label} 配置草稿` : `${intent.label} 已配置`,
        summary: isDraft
          ? '已按 user-attached connector 草稿处理，并进入当前工作区的可用能力池等待补齐配置。'
          : '已按 user-attached connector 处理，并进入当前工作区的可用能力池。',
        groups: [
          {
            key: 'configured-connectors',
            label: 'Configured Connectors',
            kind: 'connector',
            items: [
              {
                id: configured.id,
                displayName: configured.displayName,
                summary:
                  configured.healthReason ??
                  `${configured.capabilityCount} capabilities · ${configured.transport} · ${configured.source}`,
                ownerType: 'user-attached',
                scope: 'workspace',
                enabled: configured.enabled,
                status: configured.healthState
              }
            ]
          }
        ]
      }
    });
  }

  const primary = matched[0];
  await runtimeSessionService.attachSessionCapabilities(sessionId, {
    attachments: [
      {
        id: `user-connector:${primary.id}`,
        displayName: primary.displayName,
        kind: 'connector',
        owner: {
          ownerType: 'user-attached',
          ownerId: `session:${sessionId}`,
          capabilityType: 'connector',
          scope: 'workspace',
          trigger: 'user_requested'
        },
        enabled: primary.enabled,
        sourceId: primary.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    augmentations: [
      {
        id: `user-connector-ready:${primary.id}`,
        kind: 'connector',
        status: 'ready',
        requestedBy: 'user',
        target: primary.id,
        reason: `${intent.label} 已标记为当前会话优先使用的 connector。`,
        owner: {
          ownerType: 'user-attached',
          ownerId: `session:${sessionId}`,
          capabilityType: 'connector',
          scope: 'workspace',
          trigger: 'user_requested'
        },
        summary: primary.displayName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  });

  return runtimeSessionService.appendInlineCapabilityResponse(sessionId, dto, {
    role: 'assistant',
    content: `已按你的请求检索 ${intent.label}，可以继续在当前会话里明确要求使用它。`,
    card: {
      type: 'capability_catalog',
      title: `${intent.label} 请求`,
      summary: '已找到可用 connector，后续回合会优先按 user-attached connector 处理。',
      groups: [
        {
          key: 'matched-connectors',
          label: 'Matched Connectors',
          kind: 'connector',
          items: matched.map((item: any) => ({
            id: item.id,
            displayName: item.displayName,
            summary: item.summary ?? item.healthReason ?? buildTemplatePlaceholder(intent).summary,
            ownerType: 'user-attached',
            scope: 'session',
            enabled: item.enabled,
            status: item.healthState
          }))
        }
      ]
    }
  });
}
