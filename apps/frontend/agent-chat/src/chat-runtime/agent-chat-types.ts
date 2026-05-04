export interface AgentChatRuntimeThinkState {
  loading: boolean;
  messageId?: string;
  thinkingDurationMs?: number;
}

export interface AgentChatRuntimeThoughtChainItem {
  id: string;
  title: string;
}

export interface AgentChatRuntimeResponseStep {
  id: string;
  label: string;
}

export interface AgentFrontendChatMessageMeta {
  think?: AgentChatRuntimeThinkState;
  thoughtChain?: AgentChatRuntimeThoughtChainItem[];
  responseSteps?: AgentChatRuntimeResponseStep[];
}

export interface AgentFrontendChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  kind: 'text' | 'mixed';
  meta?: AgentFrontendChatMessageMeta;
}

export interface AgentChatRuntimeEvent {
  type: string;
  thinkState?: AgentChatRuntimeThinkState;
  thoughtChain?: AgentChatRuntimeThoughtChainItem[];
  responseSteps?: AgentChatRuntimeResponseStep[];
}

export interface AgentChatCardCreateSurfaceCommand {
  version: 'v0.9';
  createSurface: {
    surfaceId: string;
    catalogId: string;
  };
}

export interface AgentChatCardUpdateComponentsCommand {
  version: 'v0.9';
  updateComponents: {
    surfaceId: string;
    components: Array<{
      id: string;
      component: 'Column' | 'Text';
      children?: string[];
      text?: string;
    }>;
  };
}

export type AgentChatCardCommand = AgentChatCardCreateSurfaceCommand | AgentChatCardUpdateComponentsCommand;
