import { AdminAuthLoginRequestSchema } from '../../../../../src/contracts/admin-auth';
import { adminAuthErrorResponse, getAdminAuthServiceForRoutes } from '../../../../../src/auth/admin-auth';

export async function POST(request: Request) {
  try {
    const body = AdminAuthLoginRequestSchema.parse(await request.json());
    const tokenPair = await getAdminAuthServiceForRoutes().login(body);

    return Response.json(tokenPair);
  } catch (error) {
    return adminAuthErrorResponse(error);
  }
}
