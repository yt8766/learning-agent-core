import { adminAuthErrorResponse } from '../../../../../src/auth/admin-auth';

export async function POST() {
  try {
    return Response.json({ ok: true });
  } catch (error) {
    return adminAuthErrorResponse(error);
  }
}
