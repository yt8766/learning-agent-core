import { gatewayErrorResponse } from '../../../../src/gateway/errors';
import { getGatewayServiceForRoutes } from '../../../../src/gateway/route-runtime';

export async function GET(request: Request) {
  try {
    const service = getGatewayServiceForRoutes();
    const body = await service.listModels({
      authorization: request.headers.get('authorization')
    });

    return Response.json(body);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
