import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { AgentToolsController } from '../../src/agent-tools/agent-tools.controller';

describe('AgentToolsController', () => {
  it('uses the route prefix that composes with the global api prefix once', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AgentToolsController)).toBe('agent-tools');
  });

  it('exposes the REST facade paths documented by the tool execution API', () => {
    expectRoute('listCapabilities', RequestMethod.GET, 'capabilities');
    expectRoute('listNodes', RequestMethod.GET, 'nodes');
    expectRoute('getNode', RequestMethod.GET, 'nodes/:nodeId');
    expectRoute('getRequest', RequestMethod.GET, 'requests/:requestId');
    expectRoute('getResult', RequestMethod.GET, 'requests/:requestId/result');
    expectRoute('listEvents', RequestMethod.GET, 'events');
    expectRoute('getProjection', RequestMethod.GET, 'projection');
    expectRoute('createRequest', RequestMethod.POST, 'requests');
    expectRoute('cancelRequest', RequestMethod.POST, 'requests/:requestId/cancel');
    expectRoute('resumeApproval', RequestMethod.POST, 'requests/:requestId/approval');
    expectRoute('healthCheckNode', RequestMethod.POST, 'nodes/:nodeId/health-check');
  });

  it('delegates agent tool HTTP facade routes to the service', () => {
    const service = {
      listCapabilities: vi.fn(() => [{ capabilityId: 'capability.filesystem.read_local_file' }]),
      listNodes: vi.fn(() => [{ nodeId: 'node-local' }]),
      getNode: vi.fn(() => ({ nodeId: 'node-local' })),
      getRequest: vi.fn(() => ({ requestId: 'request-1' })),
      getResult: vi.fn(() => null),
      listEvents: vi.fn(() => [{ type: 'tool_called', payload: { requestId: 'request-1' } }]),
      getProjection: vi.fn(() => ({
        requests: [{ requestId: 'request-1' }],
        results: [],
        capabilities: [{ capabilityId: 'capability.filesystem.read_local_file' }],
        nodes: [{ nodeId: 'node-local' }],
        policyDecisions: [],
        events: [{ type: 'tool_called', payload: { requestId: 'request-1' } }]
      })),
      createRequest: vi.fn(() => ({ request: { requestId: 'request-2' } })),
      cancelRequest: vi.fn(() => ({ requestId: 'request-2', status: 'cancelled' })),
      resumeApproval: vi.fn(() => ({ request: { requestId: 'request-2', status: 'succeeded' } })),
      healthCheckNode: vi.fn(() => ({ resultId: 'health-node-local' }))
    };
    const controller = new AgentToolsController(service as never);

    expect(controller.listCapabilities({ nodeId: 'node-local' })).toEqual([
      { capabilityId: 'capability.filesystem.read_local_file' }
    ]);
    expect(controller.listNodes({ status: 'available' })).toEqual([{ nodeId: 'node-local' }]);
    expect(controller.getNode('node-local')).toEqual({ nodeId: 'node-local' });
    expect(controller.getRequest('request-1')).toEqual({ requestId: 'request-1' });
    expect(controller.getResult('request-1')).toBeNull();
    expect(controller.listEvents({ requestId: 'request-1', taskId: 'task-1', sessionId: 'session-1' })).toEqual([
      { type: 'tool_called', payload: { requestId: 'request-1' } }
    ]);
    expect(controller.listEvents({})).toEqual([{ type: 'tool_called', payload: { requestId: 'request-1' } }]);
    expect(controller.getProjection({ requestId: 'request-1' })).toEqual({
      requests: [{ requestId: 'request-1' }],
      results: [],
      capabilities: [{ capabilityId: 'capability.filesystem.read_local_file' }],
      nodes: [{ nodeId: 'node-local' }],
      policyDecisions: [],
      events: [{ type: 'tool_called', payload: { requestId: 'request-1' } }]
    });
    expect(controller.createRequest({ taskId: 'task-1' })).toEqual({ request: { requestId: 'request-2' } });
    expect(controller.cancelRequest('request-2', { actor: 'human' })).toEqual({
      requestId: 'request-2',
      status: 'cancelled'
    });
    expect(
      controller.resumeApproval('request-2', {
        sessionId: 'session-1',
        interrupt: { requestId: 'request-2', action: 'approve' }
      })
    ).toEqual({ request: { requestId: 'request-2', status: 'succeeded' } });
    expect(controller.healthCheckNode('node-local', { reason: 'smoke' })).toEqual({ resultId: 'health-node-local' });

    expect(service.listCapabilities).toHaveBeenCalledWith({ nodeId: 'node-local' });
    expect(service.listNodes).toHaveBeenCalledWith({ status: 'available' });
    expect(service.getNode).toHaveBeenCalledWith('node-local');
    expect(service.getRequest).toHaveBeenCalledWith('request-1');
    expect(service.getResult).toHaveBeenCalledWith('request-1');
    expect(service.listEvents).toHaveBeenCalledWith({
      requestId: 'request-1',
      taskId: 'task-1',
      sessionId: 'session-1'
    });
    expect(service.listEvents).toHaveBeenCalledWith({});
    expect(service.getProjection).toHaveBeenCalledWith({ requestId: 'request-1' });
    expect(service.createRequest).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(service.cancelRequest).toHaveBeenCalledWith('request-2', { actor: 'human' });
    expect(service.resumeApproval).toHaveBeenCalledWith('request-2', {
      sessionId: 'session-1',
      interrupt: { requestId: 'request-2', action: 'approve' }
    });
    expect(service.healthCheckNode).toHaveBeenCalledWith('node-local', { reason: 'smoke' });
  });
});

function expectRoute(methodName: keyof AgentToolsController, method: RequestMethod, path: string): void {
  const handler = AgentToolsController.prototype[methodName];
  expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
  expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
}
