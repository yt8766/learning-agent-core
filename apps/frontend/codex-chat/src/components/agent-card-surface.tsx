import { useMemo } from 'react';
import { Button, Space, Statistic } from 'antd';
import { XCard, registerCatalog } from '@ant-design/x-card';
import type { ActionPayload, Catalog, XAgentCommand_v0_9 } from '@ant-design/x-card';

const catalogId = 'local://codex-chat/agent-cards.json';

const codexCatalog: Catalog = {
  catalogId,
  components: {
    AgentMetric: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        value: { type: 'string' },
        tone: { type: 'string' }
      },
      required: ['label', 'value']
    },
    AgentAction: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        action: { type: 'object' }
      },
      required: ['text']
    }
  }
};

registerCatalog(codexCatalog);

function AgentMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Statistic className={`codex-agent-metric codex-agent-metric-${tone ?? 'neutral'}`} title={label} value={value} />
  );
}

function AgentAction({
  text,
  action,
  onAction
}: {
  text: string;
  action?: { event?: { context?: Record<string, unknown> } };
  onAction?: (context: Record<string, unknown>) => void;
}) {
  return (
    <Button className="codex-agent-action" onClick={() => onAction?.(action?.event?.context ?? {})}>
      {text}
    </Button>
  );
}

export function buildWelcomeCardCommands(surfaceId: string): XAgentCommand_v0_9[] {
  return [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId,
        catalogId
      }
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [
          { id: 'root', component: 'Column', children: ['latency', 'context', 'action'] },
          { id: 'latency', component: 'AgentMetric', label: '推理形态', value: 'Think + Steps', tone: 'amber' },
          { id: 'context', component: 'AgentMetric', label: '会话模式', value: 'Multi-session', tone: 'cyan' },
          {
            id: 'action',
            component: 'AgentAction',
            text: '让 Codex 规划一个复杂任务',
            action: { event: { name: 'prompt', context: { prompt: '请拆解一个端到端 AI 应用开发计划' } } }
          }
        ]
      }
    }
  ];
}

export function AgentCardSurface({
  commands,
  surfaceId,
  onPrompt
}: {
  commands: XAgentCommand_v0_9[];
  surfaceId: string;
  onPrompt?: (prompt: string) => void;
}) {
  const components = useMemo(() => ({ AgentMetric, AgentAction }), []);

  const handleAction = (payload: ActionPayload) => {
    const prompt = payload.context.prompt;
    if (typeof prompt === 'string') {
      onPrompt?.(prompt);
    }
  };

  if (commands.length === 0) {
    return null;
  }

  return (
    <div className="codex-card-surface">
      <XCard.Box commands={commands} components={components} onAction={handleAction}>
        <Space direction="vertical" size={10} className="codex-card-surface-inner">
          <XCard.Card id={surfaceId} />
        </Space>
      </XCard.Box>
    </div>
  );
}
