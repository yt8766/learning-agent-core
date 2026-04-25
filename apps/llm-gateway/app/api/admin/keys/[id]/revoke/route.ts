import { adminAuthErrorResponse, getAdminAuthServiceForRoutes } from '../../../../../../src/auth/admin-auth';
import {
  adminApiKeyRouteErrorResponse,
  revokeAdminApiKeyForRoutes
} from '../../../../../../src/admin/admin-api-key-routes';

interface AdminApiKeyRouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

export async function POST(request: Request, context: AdminApiKeyRouteContext) {
  try {
    await getAdminAuthServiceForRoutes().requireAccessToken(request.headers.get('authorization'));
    const params = await context.params;
    return Response.json(await revokeAdminApiKeyForRoutes(params.id));
  } catch (error) {
    return isAdminApiKeyRouteErrorCandidate(error)
      ? adminApiKeyRouteErrorResponse(error)
      : adminAuthErrorResponse(error);
  }
}

function isAdminApiKeyRouteErrorCandidate(error: unknown): boolean {
  return error instanceof Error && error.name !== 'AdminAuthError';
}
