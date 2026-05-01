import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { clearTokens, readTokens, saveTokens } from '../../api/token-storage';

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(() => Boolean(readTokens()));
  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      login: (email: string, password: string) => {
        if (!email || !password) {
          return;
        }
        saveTokens({
          accessToken: 'knowledge-access:user_1:1',
          refreshToken: 'knowledge-refresh:user_1:1',
          tokenType: 'Bearer',
          expiresIn: 7200,
          refreshExpiresIn: 1209600
        });
        setAuthenticated(true);
      },
      logout: () => {
        clearTokens();
        setAuthenticated(false);
      }
    }),
    [isAuthenticated]
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
