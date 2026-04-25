import { AdminAuthRefreshRequestSchema } from '../../../../../src/contracts/admin-auth';
import { adminAuthErrorResponse, getAdminAuthServiceForRoutes } from '../../../../../src/auth/admin-auth';

export async function POST(request: Request) {
  try {
    const body = AdminAuthRefreshRequestSchema.parse(await request.json());
    const tokenPair = await getAdminAuthServiceForRoutes().refresh(body);

    return Response.json(tokenPair);
  } catch (error) {
    return adminAuthErrorResponse(error);
  }
}
