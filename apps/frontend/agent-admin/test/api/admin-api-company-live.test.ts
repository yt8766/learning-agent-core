import { describe, expect, it, vi, beforeEach } from 'vitest';

const requestMock = vi.fn();

vi.mock('@/api/admin-api-core', () => ({
  request: (...args: unknown[]) => requestMock(...args)
}));

import { generateCompanyLive } from '@/api/company-live.api';

describe('admin-api-company-live', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('calls POST /company-live/generate with the brief body', async () => {
    const mockResult = {
      bundle: {
        requestId: 'req-test-1',
        assets: [
          {
            assetId: 'a1',
            type: 'audio',
            uri: 'stub://audio/a1.mp3',
            mimeType: 'audio/mpeg',
            sourceNodeId: 'generate-audio'
          }
        ],
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      trace: [
        {
          nodeId: 'generate-audio',
          status: 'succeeded',
          durationMs: 120,
          inputSnapshot: {},
          outputSnapshot: {}
        }
      ]
    };
    requestMock.mockResolvedValue(mockResult);

    const brief = {
      briefId: 'brief-1',
      targetPlatform: 'douyin',
      script: 'Hello world',
      durationSeconds: 60,
      speakerVoiceId: 'voice-default',
      backgroundMusicUri: undefined,
      brandKitRef: undefined,
      requestedBy: 'test-user'
    };

    const result = await generateCompanyLive(brief);

    expect(requestMock).toHaveBeenCalledWith('/company-live/generate', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(mockResult);
  });

  it('passes brief fields in the request body as JSON', async () => {
    requestMock.mockResolvedValue({ bundle: { requestId: 'r1', assets: [], createdAt: '' }, trace: [] });
    const brief = {
      briefId: 'b2',
      targetPlatform: 'bilibili',
      script: 'Test script',
      durationSeconds: 30,
      speakerVoiceId: 'v1',
      requestedBy: 'user-1'
    };
    await generateCompanyLive(brief);
    const [, init] = requestMock.mock.calls[0] as [string, { body: string }];
    const parsed = JSON.parse(init.body);
    expect(parsed.briefId).toBe('b2');
    expect(parsed.targetPlatform).toBe('bilibili');
  });
});
