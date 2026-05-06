import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AuthClient } from '../../api/auth-client';
import { clearTokens, readTokens } from '../../api/token-storage';

interface AuthContextValue {
  error: Error | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ authClient, children }: { authClient?: AuthClient; children: ReactNode }) {
  const client = useMemo(() => authClient ?? new AuthClient({ baseUrl: '/api/knowledge/v1' }), [authClient]);
  const [isAuthenticated, setAuthenticated] = useState(() => Boolean(readTokens()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    client.setAuthLostHandler(() => {
      setAuthenticated(false);
    });
    return () => {
      client.setAuthLostHandler(undefined);
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      isAuthenticated,
      loading,
      login: async (username: string, password: string) => {
        if (!username || !password) {
          return;
        }
        setLoading(true);
        setError(null);
        try {
          await client.login({ email: username, username, password, remember: true });
          setAuthenticated(true);
        } catch (loginError) {
          setError(loginError instanceof Error ? loginError : new Error(String(loginError)));
          setAuthenticated(false);
        } finally {
          setLoading(false);
        }
      },
      logout: () => {
        client.logout();
        clearTokens();
        setAuthenticated(false);
      }
    }),
    [client, error, isAuthenticated, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
