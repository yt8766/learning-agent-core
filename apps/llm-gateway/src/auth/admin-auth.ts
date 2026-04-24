import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ADMIN_SESSION_COOKIE = 'llm_gateway_admin';

export async function requireAdminSession(): Promise<void> {
  const configuredToken = process.env.LLM_GATEWAY_ADMIN_SESSION_TOKEN;

  if (!configuredToken) {
    redirect('/admin/login?reason=missing-admin-session-token');
  }

  const cookieStore = await cookies();
  const actualToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (actualToken !== configuredToken) {
    redirect('/admin/login');
  }
}

export function getAdminSessionCookieName(): string {
  return ADMIN_SESSION_COOKIE;
}
