import { describe, expect, it } from 'vitest';

import { MediaGenerationTaskSchema, MediaProviderErrorSchema } from '@agent/core';

import {
  MiniMaxAudioProvider,
  MiniMaxImageProvider,
  MiniMaxMusicProvider,
  MiniMaxVideoProvider,
  mapMiniMaxError,
  mapMiniMaxTask
} from '../../src';

describe('@agent/adapters MiniMax media mappers', () => {
  it.each([
    ['Preparing', 'queued'],
    ['Queueing', 'queued'],
    ['Processing', 'running'],
    ['Unknown', 'running'],
    ['Success', 'succeeded'],
    ['Fail', 'failed']
  ] as const)('maps MiniMax task status %s to stable media task status %s', (status, expectedStatus) => {
    const task = mapMiniMaxTask({
      taskId: 'task-1',
      kind: 'video',
      providerTaskId: 'mx-task-1',
      status,
      assetRefs: ['asset-video-1'],
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(task.status).toBe(expectedStatus);
    expect(task.provider).toBe('minimax');
  });

  it('falls back unknown MiniMax task status to running', () => {
    const task = mapMiniMaxTask({
      taskId: 'task-unknown',
      kind: 'video',
      providerTaskId: 'mx-task-unknown',
      status: 'PausedByVendor',
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(task.status).toBe('running');
  });

  it('emits a stable media task contract', () => {
    const task = mapMiniMaxTask({
      taskId: 'task-contract',
      kind: 'video',
      providerTaskId: 'mx-task-contract',
      status: 'Success',
      assetRefs: ['asset-video-1'],
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(MediaGenerationTaskSchema.parse(task)).toEqual(task);
  });

  it.each([
    ['rate_limit', true],
    ['timeout', true],
    ['temporarily_unavailable', true],
    ['validation_error', false]
  ] as const)('maps MiniMax error %s retryable=%s', (code, retryable) => {
    const error = mapMiniMaxError({
      code,
      message: 'MiniMax provider error'
    });

    expect(error.provider).toBe('minimax');
    expect(error.retryable).toBe(retryable);
  });

  it('emits a stable media provider error contract', () => {
    const error = mapMiniMaxError({
      code: 'timeout',
      message: 'MiniMax provider timeout'
    });

    expect(MediaProviderErrorSchema.parse(error)).toEqual(error);
  });
});

describe('@agent/adapters MiniMax media providers', () => {
  it('delegates speech tasks without leaking config secrets', async () => {
    const transport = createTransportMock();
    const provider = new MiniMaxAudioProvider({ apiKey: 'secret-key', speechModel: 'speech-custom' }, transport);

    await provider.createSpeechTask({
      text: 'hello',
      language: 'en',
      voiceId: 'voice-1',
      useCase: 'narration'
    });

    expect(provider.providerId).toBe('minimax');
    expect(transport.calls[0]).toEqual({
      operation: 'audio.createSpeechTask',
      payload: {
        provider: 'minimax',
        model: 'speech-custom',
        input: {
          text: 'hello',
          language: 'en',
          voiceId: 'voice-1',
          useCase: 'narration'
        }
      }
    });
    expect(JSON.stringify(transport.calls[0]?.payload)).not.toContain('secret-key');
    expect(transport.calls[0]?.payload).not.toHaveProperty('config');
  });

  it('delegates image generation with the default model', async () => {
    const transport = createTransportMock();
    const provider = new MiniMaxImageProvider({ apiKey: 'secret-key' }, transport);

    await provider.generateImage({
      prompt: 'a quiet workstation'
    });

    expect(provider.providerId).toBe('minimax');
    expect(transport.calls[0]).toEqual({
      operation: 'image.generateImage',
      payload: {
        provider: 'minimax',
        model: 'image-01',
        input: {
          prompt: 'a quiet workstation'
        }
      }
    });
    expect(JSON.stringify(transport.calls[0]?.payload)).not.toContain('secret-key');
    expect(transport.calls[0]?.payload).not.toHaveProperty('config');
  });

  it('delegates video tasks with the default model', async () => {
    const transport = createTransportMock();
    const provider = new MiniMaxVideoProvider({ apiKey: 'secret-key' }, transport);

    await provider.createVideoTask({
      prompt: 'city timelapse'
    });

    expect(provider.providerId).toBe('minimax');
    expect(transport.calls[0]).toEqual({
      operation: 'video.createVideoTask',
      payload: {
        provider: 'minimax',
        model: 'video-01',
        input: {
          prompt: 'city timelapse'
        }
      }
    });
    expect(JSON.stringify(transport.calls[0]?.payload)).not.toContain('secret-key');
    expect(transport.calls[0]?.payload).not.toHaveProperty('config');
  });

  it('delegates music tasks without leaking config secrets', async () => {
    const transport = createTransportMock();
    const provider = new MiniMaxMusicProvider({ apiKey: 'secret-key', musicModel: 'music-custom' }, transport);

    await provider.createMusicTask({
      prompt: 'ambient piano'
    });

    expect(provider.providerId).toBe('minimax');
    expect(transport.calls[0]).toEqual({
      operation: 'music.createMusicTask',
      payload: {
        provider: 'minimax',
        model: 'music-custom',
        input: {
          prompt: 'ambient piano'
        }
      }
    });
    expect(JSON.stringify(transport.calls[0]?.payload)).not.toContain('secret-key');
    expect(transport.calls[0]?.payload).not.toHaveProperty('config');
  });
});

function createTransportMock() {
  const calls: Array<{ operation: string; payload: unknown }> = [];

  return {
    calls,
    async request<T>(operation: string, payload: unknown): Promise<T> {
      calls.push({ operation, payload });
      return {} as T;
    }
  };
}
