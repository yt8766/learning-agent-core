import { afterEach, describe, expect, it } from 'vitest';

import { GET } from '../../app/api/v1/key/route.js';
import { createRouteTestRuntime, resetRouteTestRuntime } from '../helpers/create-route-test-runtime.js';
import { createJsonRequest, readJsonResponse } from '../helpers/http-test-helpers.js';

describe('/api/v1/key route', () => {
  afterEach(resetRouteTestRuntime);

  it('returns a gateway auth error when the bearer token is missing', async () => {
    createRouteTestRuntime();

    const response = await GET(createJsonRequest('http://localhost/api/v1/key'));
    const body = await readJsonResponse(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'AUTH_ERROR',
        message: 'Missing bearer token',
        type: 'gateway_error'
      }
    });
  });

  it('returns key metadata for a valid key through the real route handler', async () => {
    const runtime = createRouteTestRuntime();
    runtime.seedGatewayService({
      key: {
        id: 'key_route_1',
        name: 'Route test key',
        models: ['gpt-main'],
        usedTokensToday: 123,
        usedCostToday: 0.45
      }
    });

    const response = await GET(
      createJsonRequest('http://localhost/api/v1/key', {
        headers: { authorization: runtime.authorization }
      })
    );
    const body = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 'key_route_1',
      name: 'Route test key',
      status: 'active',
      models: ['gpt-main'],
      used_tokens_today: 123,
      used_cost_today: 0.45,
      expires_at: null
    });
  });
});
