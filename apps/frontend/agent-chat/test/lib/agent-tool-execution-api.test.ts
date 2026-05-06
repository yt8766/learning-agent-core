import { describe, expect, it, vi } from 'vitest';

import {
  buildAgentToolApprovalUrl,
  buildAgentToolCapabilitiesUrl,
  buildAgentToolCancelUrl,
  buildAgentToolNodeHealthCheckUrl,
  buildAgentToolNodeUrl,
  buildAgentToolNodesUrl,
  buildAgentToolProjectionUrl,
  buildAgentToolRequestResultUrl,
  buildAgentToolRequestsUrl,
  buildAgentToolEventsUrl,
  cancelAgentToolExecution,
  createAgentToolExecution,
  getAgentToolGovernanceProjection,
  getAgentToolNode,
  getAgentToolRequest,
  getAgentToolResult,
  healthCheckAgentToolNode,
  listAgentToolCapabilities,
  listAgentToolEvents,
  listAgentToolNodes,
  resumeAgentToolApproval
} from '../../src/utils/agent-tool-execution-api';

describe('agent tool execution API helpers', () => {
  it('builds endpoint URLs with encoded path and query values', () => {
    expect(buildAgentToolRequestsUrl()).toBe('/api/agent-tools/requests');
    expect(buildAgentToolRequestsUrl('request/with space')).toBe('/api/agent-tools/requests/request%2Fwith%20space');
    expect(buildAgentToolRequestResultUrl('request/with space')).toBe(
      '/api/agent-tools/requests/request%2Fwith%20space/result'
    );
    expect(buildAgentToolApprovalUrl('request/with space')).toBe(
      '/api/agent-tools/requests/request%2Fwith%20space/approval'
    );
    expect(buildAgentToolCancelUrl('request/with space')).toBe(
      '/api/agent-tools/requests/request%2Fwith%20space/cancel'
    );
    expect(buildAgentToolNodeUrl('node/with space')).toBe('/api/agent-tools/nodes/node%2Fwith%20space');
    expect(buildAgentToolNodeHealthCheckUrl('node/with space')).toBe(
      '/api/agent-tools/nodes/node%2Fwith%20space/health-check'
    );
    expect(buildAgentToolProjectionUrl()).toBe('/api/agent-tools/projection');
    expect(
      buildAgentToolProjectionUrl({
        requestId: 'request/with space',
        taskId: 'task-1',
        sessionId: 'session-1'
      })
    ).toBe('/api/agent-tools/projection?requestId=request%2Fwith+space&taskId=task-1&sessionId=session-1');
    expect(buildAgentToolEventsUrl()).toBe('/api/agent-tools/events');
    expect(
      buildAgentToolEventsUrl({
        requestId: 'request/with space',
        taskId: 'task/with space',
        sessionId: 'session/with space'
      })
    ).toBe(
      '/api/agent-tools/events?requestId=request%2Fwith+space&taskId=task%2Fwith+space&sessionId=session%2Fwith+space'
    );
    expect(
      buildAgentToolCapabilitiesUrl({
        nodeId: 'node/a',
        category: 'command shell',
        riskClass: 'high',
        requiresApproval: true
      })
    ).toBe('/api/agent-tools/capabilities?nodeId=node%2Fa&category=command+shell&riskClass=high&requiresApproval=true');
    expect(buildAgentToolNodesUrl({ status: 'online', kind: 'mcp server', sandboxMode: 'workspace-write' })).toBe(
      '/api/agent-tools/nodes?status=online&kind=mcp+server&sandboxMode=workspace-write'
    );
  });

  it('posts creation, cancellation, and approval resume bodies through the injected fetch', async () => {
    const requestRecord = buildRequestRecord({ requestId: 'request-1', status: 'queued' });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ request: requestRecord }))
      .mockResolvedValueOnce(jsonResponse(buildRequestRecord({ requestId: 'request-1', status: 'cancelled' })))
      .mockResolvedValueOnce(
        jsonResponse({ request: buildRequestRecord({ requestId: 'request-1', status: 'running' }) })
      );

    await expect(
      createAgentToolExecution(fetcher, {
        sessionId: 'session-1',
        taskId: 'task-1',
        toolName: 'shell.run',
        requestedBy: { actor: 'human' },
        input: { command: 'pnpm test' }
      })
    ).resolves.toEqual({ request: requestRecord });
    await cancelAgentToolExecution(fetcher, 'request-1', {
      sessionId: 'session-1',
      actor: 'human',
      reason: 'user cancelled'
    });
    await resumeAgentToolApproval(fetcher, 'request-1', {
      sessionId: 'session-1',
      actor: 'human',
      interrupt: {
        requestId: 'request-1',
        interruptId: 'interrupt-1',
        action: 'approve',
        approvalId: 'approval-1'
      }
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/agent-tools/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        taskId: 'task-1',
        toolName: 'shell.run',
        requestedBy: { actor: 'human' },
        input: { command: 'pnpm test' }
      })
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/agent-tools/requests/request-1/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        actor: 'human',
        reason: 'user cancelled'
      })
    });
    expect(fetcher).toHaveBeenNthCalledWith(3, '/api/agent-tools/requests/request-1/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        actor: 'human',
        interrupt: {
          requestId: 'request-1',
          interruptId: 'interrupt-1',
          action: 'approve',
          approvalId: 'approval-1'
        }
      })
    });
  });

  it('uses GET facades for requests, results, capabilities, and nodes', async () => {
    const requestRecord = buildRequestRecord({ requestId: 'request-1', status: 'succeeded' });
    const resultRecord = buildResultRecord({ resultId: 'result-1', requestId: 'request-1', status: 'succeeded' });
    const nodeRecord = buildNodeRecord({ nodeId: 'node-1' });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(requestRecord))
      .mockResolvedValueOnce(jsonResponse(resultRecord))
      .mockResolvedValueOnce(jsonResponse([buildCapabilityRecord({ capabilityId: 'cap-1' })]))
      .mockResolvedValueOnce(jsonResponse([nodeRecord]))
      .mockResolvedValueOnce(jsonResponse(nodeRecord));

    await expect(getAgentToolRequest(fetcher, 'request-1')).resolves.toEqual(requestRecord);
    await expect(getAgentToolResult(fetcher, 'request-1')).resolves.toEqual(resultRecord);
    await expect(listAgentToolCapabilities(fetcher, { requiresApproval: false })).resolves.toEqual([
      buildCapabilityRecord({ capabilityId: 'cap-1' })
    ]);
    await expect(listAgentToolNodes(fetcher, { riskClass: 'medium' })).resolves.toEqual([nodeRecord]);
    await expect(getAgentToolNode(fetcher, 'node-1')).resolves.toEqual(nodeRecord);

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/agent-tools/requests/request-1', { method: 'GET' });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/agent-tools/requests/request-1/result', { method: 'GET' });
    expect(fetcher).toHaveBeenNthCalledWith(3, '/api/agent-tools/capabilities?requiresApproval=false', {
      method: 'GET'
    });
    expect(fetcher).toHaveBeenNthCalledWith(4, '/api/agent-tools/nodes?riskClass=medium', { method: 'GET' });
    expect(fetcher).toHaveBeenNthCalledWith(5, '/api/agent-tools/nodes/node-1', { method: 'GET' });
  });

  it('keeps unfinished request results as null and posts node health-check bodies', async () => {
    const healthResult = buildResultRecord({
      resultId: 'health-result-1',
      requestId: 'health-request-1',
      status: 'succeeded'
    });
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse(null)).mockResolvedValueOnce(jsonResponse(healthResult));

    await expect(getAgentToolResult(fetcher, 'request-1')).resolves.toBeNull();
    await expect(
      healthCheckAgentToolNode(fetcher, 'node-1', {
        actor: 'human',
        reason: 'manual refresh'
      })
    ).resolves.toEqual(healthResult);

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/agent-tools/requests/request-1/result', { method: 'GET' });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/agent-tools/nodes/node-1/health-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: 'human',
        reason: 'manual refresh'
      })
    });
  });

  it('lists agent tool events from the REST event log after contract parsing', async () => {
    const eventRecord = buildChatEventRecord({
      id: 'agent_tool_request-1_0001_tool_called',
      type: 'tool_called',
      payload: {
        requestId: 'request-1',
        toolName: 'shell.run',
        inputPreview: 'pnpm test'
      }
    });
    const fetcher = vi.fn().mockResolvedValue(jsonResponse([eventRecord]));

    await expect(
      listAgentToolEvents(fetcher, {
        requestId: 'request-1',
        taskId: 'task-1',
        sessionId: 'session-1'
      })
    ).resolves.toEqual([eventRecord]);

    expect(fetcher).toHaveBeenCalledWith(
      '/api/agent-tools/events?requestId=request-1&taskId=task-1&sessionId=session-1',
      { method: 'GET' }
    );
  });

  it('gets the governance projection over GET after contract parsing each collection', async () => {
    const requestRecord = buildRequestRecord({ requestId: 'request-1', status: 'succeeded' });
    const resultRecord = buildResultRecord({ resultId: 'result-1', requestId: 'request-1', status: 'succeeded' });
    const capabilityRecord = buildCapabilityRecord({ capabilityId: 'cap-1' });
    const nodeRecord = buildNodeRecord({ nodeId: 'node-1' });
    const policyDecisionRecord = buildPolicyDecisionRecord({ decisionId: 'decision-1', requestId: 'request-1' });
    const eventRecord = buildChatEventRecord({
      id: 'agent_tool_request-1_0001_tool_called',
      type: 'tool_called',
      payload: {
        requestId: 'request-1',
        toolName: 'shell.run'
      }
    });
    const projection = {
      requests: [requestRecord],
      results: [resultRecord],
      capabilities: [capabilityRecord],
      nodes: [nodeRecord],
      policyDecisions: [policyDecisionRecord],
      events: [eventRecord]
    };
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(projection));

    await expect(
      getAgentToolGovernanceProjection(fetcher, {
        requestId: 'request-1',
        taskId: 'task-1',
        sessionId: 'session-1'
      })
    ).resolves.toEqual(projection);

    expect(fetcher).toHaveBeenCalledWith(
      '/api/agent-tools/projection?requestId=request-1&taskId=task-1&sessionId=session-1',
      { method: 'GET' }
    );
  });

  it('throws the facade parse error when the governance projection violates the contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        requests: [buildRequestRecord({ requestId: 'request-1', status: 'not-a-status' })],
        results: [],
        capabilities: [],
        nodes: [],
        policyDecisions: [],
        events: []
      })
    );

    await expect(getAgentToolGovernanceProjection(fetcher)).rejects.toMatchObject({
      name: 'AgentToolExecutionApiError',
      status: 200,
      code: 'agent_tool_response_invalid',
      message: 'Agent tool API response did not match the expected contract'
    });
  });

  it('throws the facade parse error when listed agent tool events violate the contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse([
        buildChatEventRecord({
          id: 'agent_tool_request-1_0001_tool_called',
          type: 'tool_called',
          payload: null
        })
      ])
    );

    await expect(listAgentToolEvents(fetcher, { requestId: 'request-1' })).rejects.toMatchObject({
      name: 'AgentToolExecutionApiError',
      status: 200,
      code: 'agent_tool_response_invalid',
      message: 'Agent tool API response did not match the expected contract'
    });
  });

  it('throws a typed error with response diagnostics for non-OK responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'agent_tool_request_not_found',
            message: 'Request not found',
            details: { requestId: 'missing-request' }
          }
        },
        { status: 404 }
      )
    );

    await expect(getAgentToolRequest(fetcher, 'missing-request')).rejects.toMatchObject({
      name: 'AgentToolExecutionApiError',
      status: 404,
      code: 'agent_tool_request_not_found',
      message: 'Request not found',
      details: { requestId: 'missing-request' }
    });
  });

  it('throws a typed parse error when successful responses do not match the contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ requestId: 'request-1' }));

    await expect(getAgentToolRequest(fetcher, 'request-1')).rejects.toMatchObject({
      name: 'AgentToolExecutionApiError',
      status: 200,
      code: 'agent_tool_response_invalid',
      message: 'Agent tool API response did not match the expected contract'
    });
  });
});

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function buildRequestRecord(overrides: { requestId: string; status: string }) {
  return {
    requestId: overrides.requestId,
    taskId: 'task-1',
    sessionId: 'session-1',
    nodeId: 'node-1',
    toolName: 'shell.run',
    requestedBy: { actor: 'human' },
    status: overrides.status,
    riskClass: 'medium',
    createdAt: '2026-04-26T00:00:00.000Z'
  };
}

function buildResultRecord(overrides: { resultId: string; requestId: string; status: string }) {
  return {
    resultId: overrides.resultId,
    requestId: overrides.requestId,
    taskId: 'task-1',
    nodeId: 'node-1',
    status: overrides.status,
    outputPreview: 'done',
    artifactIds: [],
    evidenceIds: [],
    createdAt: '2026-04-26T00:00:00.000Z'
  };
}

function buildCapabilityRecord(overrides: { capabilityId: string }) {
  return {
    capabilityId: overrides.capabilityId,
    nodeId: 'node-1',
    toolName: 'shell.run',
    category: 'terminal',
    riskClass: 'medium',
    requiresApproval: false
  };
}

function buildNodeRecord(overrides: { nodeId: string }) {
  return {
    nodeId: overrides.nodeId,
    displayName: 'Local terminal',
    kind: 'local_terminal',
    status: 'available',
    sandboxMode: 'sandboxed',
    riskClass: 'medium',
    capabilities: [buildCapabilityRecord({ capabilityId: 'cap-1' })],
    permissionScope: {},
    health: { ok: true, checkedAt: '2026-04-26T00:00:00.000Z' },
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z'
  };
}

function buildPolicyDecisionRecord(overrides: { decisionId: string; requestId: string }) {
  return {
    decisionId: overrides.decisionId,
    requestId: overrides.requestId,
    decision: 'allow',
    reasonCode: 'trusted_tool',
    reason: 'Tool is allowed for this session',
    matchedPolicyIds: ['policy-1'],
    requiresApproval: false,
    riskClass: 'medium',
    createdAt: '2026-04-26T00:00:00.000Z'
  };
}

function buildChatEventRecord(overrides: { id: string; type: string; payload: unknown }) {
  return {
    id: overrides.id,
    sessionId: 'session-1',
    type: overrides.type,
    at: '2026-04-26T00:00:00.000Z',
    payload: overrides.payload
  };
}
