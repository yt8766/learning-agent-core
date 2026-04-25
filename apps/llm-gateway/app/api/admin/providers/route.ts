import {
  adminProviderModelErrorResponse,
  getAdminProviderModelRouteServiceForRoutes,
  requireAdminAccess
} from '../../../../src/admin/admin-provider-model-routes';

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request.headers.get('authorization'));
    return Response.json(await getAdminProviderModelRouteServiceForRoutes().listProviders());
  } catch (error) {
    return adminProviderModelErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminAccess(request.headers.get('authorization'));
    return Response.json(await getAdminProviderModelRouteServiceForRoutes().createProvider(await request.json()));
  } catch (error) {
    return adminProviderModelErrorResponse(error);
  }
}
