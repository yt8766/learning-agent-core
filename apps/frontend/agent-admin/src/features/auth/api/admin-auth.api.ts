import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminLogoutRequest,
  AdminLogoutResponse,
  AdminMeResponse,
  AdminRefreshResponse
} from '@agent/core';

import { request } from '@/api/admin-api-core';

export function loginAdminAuth(input: AdminLoginRequest): Promise<AdminLoginResponse> {
  return request<AdminLoginResponse>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true
  });
}

export function refreshAdminAuth(refreshToken?: string): Promise<AdminRefreshResponse> {
  return request<AdminRefreshResponse>('/admin/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    skipAuth: true
  });
}

export function logoutAdminAuth(input: AdminLogoutRequest): Promise<AdminLogoutResponse> {
  return request<AdminLogoutResponse>('/admin/auth/logout', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true
  });
}

export function getAdminMe(): Promise<AdminMeResponse> {
  return request<AdminMeResponse>('/admin/auth/me');
}
