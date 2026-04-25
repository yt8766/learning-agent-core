import { afterEach, describe, expect, it } from 'vitest';

import { GET } from '../../app/api/v1/models/route.js';
import { createRouteTestRuntime, resetRouteTestRuntime } from '../helpers/create-route-test-runtime.js';
import { createJsonRequest, readJsonResponse } from '../helpers/http-test-helpers.js';

describe('/api/v1/models route', () => {
  afterEach(resetRouteTestRuntime);

  it('returns a gateway auth error when the bearer token is missing', async () => {
    createRouteTestRuntime();

    const response = await GET(createJsonRequest('http://localhost/api/v1/models'));
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

  it('returns models allowed for a valid key through the real route handler', async () => {
    const runtime = createRouteTestRuntime();
    runtime.seedGatewayService({
      models: ['gpt-main', 'gpt-fast']
    });

    const response = await GET(
      createJsonRequest('http://localhost/api/v1/models', {
        headers: { authorization: runtime.authorization }
      })
    );
    const body = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      object: 'list',
      data: [
        { id: 'gpt-main', object: 'model', owned_by: 'llm-gateway' },
        { id: 'gpt-fast', object: 'model', owned_by: 'llm-gateway' }
      ]
    });
  });
});
