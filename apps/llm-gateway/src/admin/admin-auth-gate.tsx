'use client';

import { ReactNode, useEffect, useState } from 'react';

import { getStoredAdminAuth } from '../auth/admin-client-auth';

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (getStoredAdminAuth()) {
      setIsAuthenticated(true);
      return;
    }

    window.location.replace('/admin/login');
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
