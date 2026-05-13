/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockSetAuthLostHandler = vi.fn();
let mockReadTokensResult: any = null;
let mockIsRefreshTokenExpired = false;

vi.mock('@/api/auth-client', () => {
  class MockAuthClient {
    setAuthLostHandler = mockSetAuthLostHandler;
    login = mockLogin;
    logout = mockLogout;
  }
  return { AuthClient: MockAuthClient };
});

vi.mock('@/api/token-storage', () => ({
  readTokens: vi.fn(() => mockReadTokensResult),
  isRefreshTokenExpired: vi.fn(() => mockIsRefreshTokenExpired),
  clearTokens: vi.fn()
}));

import { AuthProvider, useAuth } from '@/pages/auth/auth-provider';

function createMockAuthClient() {
  return {
    setAuthLostHandler: mockSetAuthLostHandler,
    login: mockLogin,
    logout: mockLogout
  } as any;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadTokensResult = null;
    mockIsRefreshTokenExpired = false;
    mockLogin.mockReset();
    mockLogout.mockReset();
    mockSetAuthLostHandler.mockReset();
  });

  it('renders children', () => {
    const html = renderToStaticMarkup(
      <AuthProvider authClient={createMockAuthClient()}>
        <div>Test Content</div>
      </AuthProvider>
    );

    expect(html).toContain('Test Content');
  });

  it('renders multiple children', () => {
    const html = renderToStaticMarkup(
      <AuthProvider authClient={createMockAuthClient()}>
        <div>Child 1</div>
        <div>Child 2</div>
      </AuthProvider>
    );

    expect(html).toContain('Child 1');
    expect(html).toContain('Child 2');
  });

  it('does not treat expired stored refresh tokens as an authenticated session', () => {
    mockReadTokensResult = {
      accessToken: 'old',
      accessTokenExpiresAt: 1770000000000,
      refreshToken: 'expired',
      refreshTokenExpiresAt: 1760000000000
    };
    mockIsRefreshTokenExpired = true;

    const html = renderToStaticMarkup(
      <AuthProvider authClient={createMockAuthClient()}>
        <TestComponent />
      </AuthProvider>
    );

    expect(html).toContain('not authenticated');
  });
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderToStaticMarkup(<TestComponent />);
    }).toThrow('useAuth must be used inside AuthProvider');
  });
});

function TestComponent() {
  const auth = useAuth();
  return <div>{auth.isAuthenticated ? 'authenticated' : 'not authenticated'}</div>;
}
