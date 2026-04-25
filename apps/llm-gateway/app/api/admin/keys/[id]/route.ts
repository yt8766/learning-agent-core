import { adminAuthErrorResponse, getAdminAuthServiceForRoutes } from '../../../../../src/auth/admin-auth';
import { UpdateApiKeyRequestSchema } from '../../../../../src/contracts/admin-api-key';
import {
  adminApiKeyRouteErrorResponse,
  revokeAdminApiKeyForRoutes,
  updateAdminApiKeyForRoutes
} from '../../../../../src/admin/admin-api-key-routes';

interface AdminApiKeyRouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: AdminApiKeyRouteContext) {
  try {
    await getAdminAuthServiceForRoutes().requireAccessToken(request.headers.get('authorization'));
    const body = UpdateApiKeyRequestSchema.parse(await request.json());
    const params = await context.params;
    return Response.json(await updateAdminApiKeyForRoutes(params.id, body));
  } catch (error) {
    return isAdminApiKeyRouteErrorCandidate(error)
      ? adminApiKeyRouteErrorResponse(error)
      : adminAuthErrorResponse(error);
  }
}

function isAdminApiKeyRouteErrorCandidate(error: unknown): boolean {
  return error instanceof Error && error.name !== 'AdminAuthError';
}

export async function DELETE(request: Request, context: AdminApiKeyRouteContext) {
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
