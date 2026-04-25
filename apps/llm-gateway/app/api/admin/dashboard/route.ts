import { adminAuthErrorResponse, getAdminAuthServiceForRoutes } from '../../../../src/auth/admin-auth';
import {
  adminLogsRouteErrorResponse,
  getAdminDashboardForRoutes,
  parseAdminRequestLogQuery
} from '../../../../src/admin/admin-logs-routes';

export async function GET(request: Request) {
  try {
    await getAdminAuthServiceForRoutes().requireAccessToken(request.headers.get('authorization'));
    return Response.json(await getAdminDashboardForRoutes(parseAdminRequestLogQuery(request.url)));
  } catch (error) {
    return isAdminLogsRouteErrorCandidate(error) ? adminLogsRouteErrorResponse(error) : adminAuthErrorResponse(error);
  }
}

function isAdminLogsRouteErrorCandidate(error: unknown): boolean {
  return error instanceof Error && error.name !== 'AdminAuthError';
}
