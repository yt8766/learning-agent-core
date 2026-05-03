import { describe, expect, it } from 'vitest';

import { ActionIntent } from '@agent/core';

import { createMiniMaxCliBindings } from '../../src/runtime/minimax-cli-bindings';

describe('createMiniMaxCliBindings', () => {
  it('builds web_search argv with query and api key', () => {
    const bindings = createMiniMaxCliBindings('sk-test');
    const binding = bindings.get('minimax:web_search');
    expect(binding).toBeDefined();
    const payload = binding!.buildPayload(
      {
        taskId: 't1',
        toolName: 'web_search',
        intent: ActionIntent.CALL_EXTERNAL_API,
        input: { query: 'hello world' },
        requestedBy: 'agent'
      },
      { id: 'minimax:web_search' } as never
    );
    expect(payload.args).toEqual(['search', 'query', '--q', 'hello world', '--output', 'json', '--api-key', 'sk-test']);
  });

  it('normalizes web_search JSON into intel-engine compatible results shape', () => {
    const bindings = createMiniMaxCliBindings('sk-test');
    const binding = bindings.get('minimax:web_search')!;
    const out = binding.parseResponse(
      {
        stdout:
          '{"results":[{"title":"A","url":"https://a.example","summary":"one"},{"link":"https://b.example","name":"B","snippet":"two"}]}',
        stderr: '',
        exitCode: 0
      },
      { id: 'minimax:web_search' } as never
    );
    expect(out).toEqual({
      results: [
        { title: 'A', url: 'https://a.example', summary: 'one' },
        { title: 'B', url: 'https://b.example', summary: 'two' }
      ]
    });
  });

  it('builds understand_image argv from common input fields', () => {
    const bindings = createMiniMaxCliBindings('sk-test');
    const binding = bindings.get('minimax:understand_image')!;
    const payload = binding.buildPayload(
      {
        taskId: 't1',
        toolName: 'understand_image',
        intent: ActionIntent.CALL_EXTERNAL_API,
        input: { url: 'https://img/x.png', prompt: 'what is this' },
        requestedBy: 'agent'
      },
      { id: 'minimax:understand_image' } as never
    );
    expect(payload.args).toEqual([
      'vision',
      'describe',
      '--image',
      'https://img/x.png',
      '--prompt',
      'what is this',
      '--output',
      'json',
      '--api-key',
      'sk-test'
    ]);
  });
});
