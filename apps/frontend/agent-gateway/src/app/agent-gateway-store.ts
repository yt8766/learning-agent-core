import { create } from 'zustand';

interface AgentGatewayUiState {
  rememberPassword: boolean;
  setRememberPassword: (remember: boolean) => void;
}

export const useAgentGatewayUiStore = create<AgentGatewayUiState>(set => ({
  rememberPassword: false,
  setRememberPassword: rememberPassword => set({ rememberPassword })
}));
