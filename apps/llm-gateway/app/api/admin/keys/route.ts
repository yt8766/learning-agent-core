import { adminAuthErrorResponse, getAdminAuthServiceForRoutes } from '../../../../src/auth/admin-auth';
import { CreateApiKeyRequestSchema } from '../../../../src/contracts/admin-api-key';
import {
  adminApiKeyRouteErrorResponse,
  createAdminApiKeyForRoutes,
  listAdminApiKeysForRoutes
} from '../../../../src/admin/admin-api-key-routes';

export async function GET(request: Request) {
  try {
    await getAdminAuthServiceForRoutes().requireAccessToken(request.headers.get('authorization'));
    return Response.json(await listAdminApiKeysForRoutes());
  } catch (error) {
    return isAdminApiKeyRouteErrorCandidate(error)
      ? adminApiKeyRouteErrorResponse(error)
      : adminAuthErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await getAdminAuthServiceForRoutes().requireAccessToken(request.headers.get('authorization'));
    const body = CreateApiKeyRequestSchema.parse(await request.json());
    return Response.json(await createAdminApiKeyForRoutes(body));
  } catch (error) {
    return isAdminApiKeyRouteErrorCandidate(error)
      ? adminApiKeyRouteErrorResponse(error)
      : adminAuthErrorResponse(error);
  }
}

function isAdminApiKeyRouteErrorCandidate(error: unknown): boolean {
  return error instanceof Error && error.name !== 'AdminAuthError';
}
