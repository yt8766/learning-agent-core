import { describe, expect, it } from 'vitest';

import { assertVoiceCloneRequestAllowed } from '../src';

describe('assertVoiceCloneRequestAllowed - extended coverage', () => {
  const validRequest = {
    sourceAudioAssetId: 'asset-1',
    requestedVoiceId: 'host-voice',
    voiceOwner: 'Host A',
    consentEvidenceRef: 'evidence-ref-001',
    intendedUse: 'Authorized preview voiceover.',
    allowedScopes: ['company-live-preview'],
    riskContext: { riskLevel: 'high' as const, reason: 'voice_clone' }
  };

  it('returns the parsed request when all fields are valid', () => {
    const result = assertVoiceCloneRequestAllowed(validRequest);
    expect(result.consentEvidenceRef).toBe('evidence-ref-001');
    expect(result.allowedScopes).toEqual(['company-live-preview']);
    expect(result.voiceOwner).toBe('Host A');
  });

  it('blocks voice clone requests with whitespace-only consentEvidenceRef', () => {
    expect(() => assertVoiceCloneRequestAllowed({ ...validRequest, consentEvidenceRef: '   ' })).toThrow(
      'Voice clone consent evidence is required.'
    );
  });

  it('blocks voice clone requests with empty allowedScopes array', () => {
    expect(() => assertVoiceCloneRequestAllowed({ ...validRequest, allowedScopes: [] })).toThrow(
      'Voice clone allowed scopes are required.'
    );
  });

  it('blocks voice clone requests with undefined consentEvidenceRef', () => {
    expect(() =>
      assertVoiceCloneRequestAllowed({ ...validRequest, consentEvidenceRef: undefined as unknown as string })
    ).toThrow('Voice clone consent evidence is required.');
  });

  it('blocks voice clone requests with undefined allowedScopes', () => {
    expect(() =>
      assertVoiceCloneRequestAllowed({
        ...validRequest,
        allowedScopes: undefined as unknown as string[]
      })
    ).toThrow('Voice clone allowed scopes are required.');
  });

  it('accepts request with multiple allowed scopes', () => {
    const result = assertVoiceCloneRequestAllowed({
      ...validRequest,
      allowedScopes: ['company-live-preview', 'personal-use']
    });
    expect(result.allowedScopes).toHaveLength(2);
  });
});
