import {
  adminProviderModelErrorResponse,
  getAdminProviderModelRouteServiceForRoutes,
  requireAdminAccess,
  routeParamsId
} from '../../../../../src/admin/admin-provider-model-routes';

export async function PATCH(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    await requireAdminAccess(request.headers.get('authorization'));
    const providerId = await routeParamsId(context);
    return Response.json(
      await getAdminProviderModelRouteServiceForRoutes().updateProvider(providerId, await request.json())
    );
  } catch (error) {
    return adminProviderModelErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    await requireAdminAccess(request.headers.get('authorization'));
    const providerId = await routeParamsId(context);
    return Response.json(await getAdminProviderModelRouteServiceForRoutes().deleteProvider(providerId));
  } catch (error) {
    return adminProviderModelErrorResponse(error);
  }
}
