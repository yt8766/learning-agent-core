import { VoiceCloneRequestSchema, type VoiceCloneRequest } from '@agent/core';

export function assertVoiceCloneRequestAllowed(input: VoiceCloneRequest): VoiceCloneRequest {
  if (!input.consentEvidenceRef?.trim()) {
    throw new Error('Voice clone consent evidence is required.');
  }
  if (!input.allowedScopes?.length) {
    throw new Error('Voice clone allowed scopes are required.');
  }
  return VoiceCloneRequestSchema.parse(input);
}
