import type { ReactNode } from 'react';

import { LoginPage } from '../features/auth/login-page';
import { useAuth } from '../features/auth/auth-provider';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <LoginPage />;
}
