import { AdminAuthChangePasswordRequestSchema } from '../../../../../src/contracts/admin-auth';
import { adminAuthErrorResponse, getAdminAuthServiceForRoutes } from '../../../../../src/auth/admin-auth';

export async function POST(request: Request) {
  try {
    const body = AdminAuthChangePasswordRequestSchema.parse(await request.json());
    const tokenPair = await getAdminAuthServiceForRoutes().changePassword({
      authorization: request.headers.get('authorization'),
      currentPassword: body.currentPassword,
      newPassword: body.newPassword
    });

    return Response.json(tokenPair);
  } catch (error) {
    return adminAuthErrorResponse(error);
  }
}
