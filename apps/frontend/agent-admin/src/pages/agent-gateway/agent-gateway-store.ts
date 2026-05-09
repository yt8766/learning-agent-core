import { create } from 'zustand';

export type GatewayConfigTab = 'visual' | 'source';

type AgentGatewayState = {
  authFileFilter: string;
  configTab: GatewayConfigTab;
  setAuthFileFilter: (filter: string) => void;
  setConfigTab: (tab: GatewayConfigTab) => void;
};

export const useAgentGatewayStore = create<AgentGatewayState>(set => ({
  authFileFilter: 'AgentFlow',
  configTab: 'visual',
  setAuthFileFilter: authFileFilter => set({ authFileFilter }),
  setConfigTab: configTab => set({ configTab })
}));
