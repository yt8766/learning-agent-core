import { gatewayErrorResponse } from '../../../../../src/gateway/errors';
import { getGatewayServiceForRoutes } from '../../../../../src/gateway/route-runtime';
import { createOpenAiSseStream } from '../../../../../src/gateway/sse';

export async function POST(request: Request) {
  try {
    const service = getGatewayServiceForRoutes();
    const body = await request.json();

    if (body?.stream === true) {
      const stream = await service.stream({
        authorization: request.headers.get('authorization'),
        body
      });

      return new Response(createOpenAiSseStream(stream), {
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive'
        }
      });
    }

    const response = await service.complete({
      authorization: request.headers.get('authorization'),
      body
    });

    return Response.json(response);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
