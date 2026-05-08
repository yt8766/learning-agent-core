import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GatewaySession } from '@agent/core';
import { createGatewayAuthApi, type GatewayAuthApi } from './auth-api';
import { clearGatewayRefreshToken, readGatewayRefreshToken, writeGatewayRefreshToken } from './auth-storage';
export interface GatewayAuthState {
  accessToken: string | null;
  session: GatewaySession | null;
  status: 'checking' | 'anonymous' | 'authenticated';
  login(username: string, password: string): Promise<void>;
  logout(): void;
  refreshAccessToken(): Promise<string | null>;
}
const Context = createContext<GatewayAuthState | null>(null);
export function GatewayAuthProvider({
  children,
  authApi = createGatewayAuthApi()
}: {
  children: ReactNode;
  authApi?: GatewayAuthApi;
}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [session, setSession] = useState<GatewaySession | null>(null);
  const [status, setStatus] = useState<GatewayAuthState['status']>('checking');
  const generationRef = useRef(0);
  const clear = useCallback(() => {
    setAccessToken(null);
    setSession(null);
    setStatus('anonymous');
  }, []);
  const logout = useCallback(() => {
    generationRef.current += 1;
    clearGatewayRefreshToken();
    clear();
  }, [clear]);
  const refreshAccessToken = useCallback(async () => {
    const token = readGatewayRefreshToken();
    if (!token) {
      clear();
      return null;
    }
    const generation = generationRef.current;
    try {
      const response = await authApi.refresh(token);
      if (generation !== generationRef.current || readGatewayRefreshToken() !== token) return null;
      setAccessToken(response.accessToken);
      setSession(response.session);
      setStatus('authenticated');
      return response.accessToken;
    } catch (error) {
      if (generation === generationRef.current && readGatewayRefreshToken() === token) {
        clearGatewayRefreshToken();
        clear();
      }
      throw error;
    }
  }, [authApi, clear]);
  const login = useCallback(
    async (username: string, password: string) => {
      generationRef.current += 1;
      const response = await authApi.login(username, password);
      writeGatewayRefreshToken(response.refreshToken);
      setAccessToken(response.accessToken);
      setSession(response.session);
      setStatus('authenticated');
    },
    [authApi]
  );
  useEffect(() => {
    refreshAccessToken().catch(() => undefined);
  }, [refreshAccessToken]);
  const value = useMemo(
    () => ({ accessToken, session, status, login, logout, refreshAccessToken }),
    [accessToken, session, status, login, logout, refreshAccessToken]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useGatewayAuth(): GatewayAuthState {
  const value = useContext(Context);
  if (!value) throw new Error('useGatewayAuth must be used within GatewayAuthProvider');
  return value;
}
