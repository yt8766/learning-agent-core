import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { HttpTransportHandler } from '../../src/transports/mcp-http-transport';
import type { McpCapabilityDefinition } from '../../src/mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../../src/mcp/mcp-server-registry';
import { ActionIntent } from '@agent/core';

const capability: McpCapabilityDefinition = {
  id: 'http-srv:tool_a',
  toolName: 'tool_a',
  serverId: 'http-srv',
  displayName: 'Tool A',
  riskLevel: 'low',
  requiresApproval: false,
  category: 'knowledge'
};

const server: McpServerDefinition = {
  id: 'http-srv',
  displayName: 'HTTP Server',
  transport: 'http',
  enabled: true,
  endpoint: 'https://mcp.example.com/invoke'
};

function makeRequest() {
  return {
    taskId: 'task-1',
    toolName: 'tool_a',
    intent: ActionIntent.CALL_EXTERNAL_API,
    input: { key: 'value' },
    requestedBy: 'agent' as const
  };
}

describe('HttpTransportHandler', () => {
  let handler: HttpTransportHandler;

  beforeEach(() => {
    handler = new HttpTransportHandler();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('invoke', () => {
    it('returns missing_endpoint error when server has no endpoint', async () => {
      const result = await handler.invoke({ ...server, endpoint: undefined }, capability, makeRequest());

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('missing_endpoint');
      expect(result.transportUsed).toBe('http');
    });

    it('sends POST request with JSON body and returns parsed result', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true, outputSummary: 'done', rawOutput: { data: 42 } })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await handler.invoke(server, capability, makeRequest());

      expect(fetch).toHaveBeenCalledWith(
        'https://mcp.example.com/invoke',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'content-type': 'application/json' })
        })
      );
      expect(result.ok).toBe(true);
      expect(result.transportUsed).toBe('http');
    });

    it('includes server headers in the request', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ ok: true }) };
      (fetch as any).mockResolvedValue(mockResponse);

      await handler.invoke({ ...server, headers: { Authorization: 'Bearer token' } }, capability, makeRequest());

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' })
        })
      );
    });

    it('returns error when HTTP response is not ok', async () => {
      const mockResponse = { ok: false, status: 503, json: vi.fn() };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await handler.invoke(server, capability, makeRequest());

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('http_503');
      expect(result.exitCode).toBe(1);
    });

    it('handles fetch network error', async () => {
      (fetch as any).mockRejectedValue(new Error('Network failure'));

      const result = await handler.invoke(server, capability, makeRequest());

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('Network failure');
    });

    it('handles non-Error thrown from fetch', async () => {
      (fetch as any).mockRejectedValue('string error');

      const result = await handler.invoke(server, capability, makeRequest());

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('http_request_failed');
    });

    it('defaults missing fields in response payload', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await handler.invoke(server, capability, makeRequest());

      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('getHealth', () => {
    it('returns disabled when server is disabled', () => {
      const health = handler.getHealth({ ...server, enabled: false }, [capability]);

      expect(health.healthState).toBe('disabled');
      expect(health.healthReason).toBe('connector_disabled');
    });

    it('returns degraded when server has no endpoint', () => {
      const health = handler.getHealth({ ...server, endpoint: undefined }, [capability]);

      expect(health.healthState).toBe('degraded');
      expect(health.healthReason).toBe('missing_http_endpoint');
    });

    it('returns healthy when server is enabled with endpoint', () => {
      const health = handler.getHealth(server, [capability]);

      expect(health.healthState).toBe('healthy');
      expect(health.implementedCapabilityCount).toBe(1);
    });
  });

  describe('discover', () => {
    it('returns error when server has no discovery endpoint or endpoint', async () => {
      const discovery = await handler.discover({ ...server, endpoint: undefined }, [capability]);

      expect(discovery.sessionState).toBe('error');
      expect(discovery.errorMessage).toBe('missing_http_discovery_endpoint');
    });

    it('uses discoveryEndpoint when set', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ result: { tools: [{ name: 'tool_a' }] } })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await handler.discover({ ...server, discoveryEndpoint: 'https://mcp.example.com/discover' }, [capability]);

      expect(fetch).toHaveBeenCalledWith('https://mcp.example.com/discover', expect.any(Object));
    });

    it('parses tools from top-level response', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ tools: [{ name: 'tool_a' }, { name: 'tool_b' }] })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const discovery = await handler.discover(server, [capability]);

      expect(discovery.sessionState).toBe('connected');
      expect(discovery.discoveredCapabilities).toEqual(['tool_a', 'tool_b']);
      expect(discovery.discoveryMode).toBe('remote');
    });

    it('falls back to registered capabilities when tools array is empty', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ tools: [] }) };
      (fetch as any).mockResolvedValue(mockResponse);

      const discovery = await handler.discover(server, [capability]);

      expect(discovery.discoveryMode).toBe('registered');
      expect(discovery.discoveredCapabilities).toEqual(['tool_a']);
    });

    it('handles non-ok discovery response', async () => {
      const mockResponse = { ok: false, status: 401, json: vi.fn() };
      (fetch as any).mockResolvedValue(mockResponse);

      const discovery = await handler.discover(server, [capability]);

      expect(discovery.sessionState).toBe('error');
      expect(discovery.errorMessage).toBe('http_discovery_401');
    });

    it('handles fetch error during discovery', async () => {
      (fetch as any).mockRejectedValue(new Error('connection refused'));

      const discovery = await handler.discover(server, [capability]);

      expect(discovery.sessionState).toBe('error');
      expect(discovery.errorMessage).toBe('connection refused');
    });

    it('handles non-Error during discovery', async () => {
      (fetch as any).mockRejectedValue('timeout');

      const discovery = await handler.discover(server, [capability]);

      expect(discovery.errorMessage).toBe('http_discovery_failed');
    });

    it('filters out tools without valid names', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ tools: [{ name: 'valid' }, { name: '' }, { noName: true }] })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const discovery = await handler.discover(server, [capability]);

      expect(discovery.discoveredCapabilities).toEqual(['valid']);
    });
  });
});
