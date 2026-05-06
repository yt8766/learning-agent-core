export interface KnowledgeUser {
  id: string;
  email: string;
  name: string;
  currentWorkspaceId: string;
  roles: string[];
  permissions: string[];
}

export interface KnowledgeLoginRequest {
  email: string;
  password: string;
}

export interface KnowledgeRefreshRequest {
  refreshToken: string;
}

export interface KnowledgeLogoutRequest {
  refreshToken?: string;
}

export interface KnowledgeMeRequest {
  authorization?: string;
}

export interface KnowledgeTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface KnowledgeAuthSession {
  user: KnowledgeUser;
  tokens: KnowledgeTokenPair;
}

export interface KnowledgeRefreshSession {
  tokens: KnowledgeTokenPair;
}
