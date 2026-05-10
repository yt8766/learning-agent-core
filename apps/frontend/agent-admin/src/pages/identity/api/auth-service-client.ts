import { AuthUsersListResponseSchema, type AuthUsersListResponse } from '@agent/core';

export interface AuthServiceClientOptions {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  fetchImpl?: typeof fetch;
}

export interface AuthServiceClient {
  listUsers(): Promise<AuthUsersListResponse>;
}

export function createAuthServiceClient(options: AuthServiceClientOptions): AuthServiceClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  return {
    async listUsers() {
      const response = await fetchImpl(`${baseUrl}/identity/users`, {
        headers: {
          authorization: `Bearer ${options.getAccessToken() ?? ''}`
        }
      });
      const body = await response.json();
      return AuthUsersListResponseSchema.parse(body);
    }
  };
}
