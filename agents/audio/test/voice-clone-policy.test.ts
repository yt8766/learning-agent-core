import { describe, expect, it } from 'vitest';
import { assertVoiceCloneRequestAllowed } from '../src';

describe('@agent/agents-audio voice clone policy', () => {
  it('blocks voice clone requests without consent evidence', () => {
    expect(() =>
      assertVoiceCloneRequestAllowed({
        sourceAudioAssetId: 'asset-1',
        requestedVoiceId: 'host-voice',
        voiceOwner: 'Host A',
        consentEvidenceRef: '',
        intendedUse: 'Authorized preview voiceover.',
        allowedScopes: ['company-live-preview'],
        riskContext: { riskLevel: 'high', reason: 'voice_clone' }
      })
    ).toThrow('Voice clone consent evidence is required.');
  });
});
