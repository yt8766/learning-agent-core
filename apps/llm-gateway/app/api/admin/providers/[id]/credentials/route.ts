import {
  adminProviderModelErrorResponse,
  getAdminProviderModelRouteServiceForRoutes,
  requireAdminAccess,
  routeParamsId
} from '../../../../../../src/admin/admin-provider-model-routes';

export async function POST(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    await requireAdminAccess(request.headers.get('authorization'));
    const providerId = await routeParamsId(context);
    return Response.json(
      await getAdminProviderModelRouteServiceForRoutes().createProviderCredential(providerId, await request.json())
    );
  } catch (error) {
    return adminProviderModelErrorResponse(error);
  }
}
