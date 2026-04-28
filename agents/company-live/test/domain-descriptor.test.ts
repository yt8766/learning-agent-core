import { describe, expect, it } from 'vitest';

import { companyLiveDomainDescriptor } from '../src';

describe('@agent/agents-company-live domain descriptor', () => {
  it('is a composite agent that orchestrates audio, image, and video', () => {
    expect(companyLiveDomainDescriptor.type).toBe('composite');
    expect(companyLiveDomainDescriptor.orchestrates).toEqual(expect.arrayContaining(['audio', 'image', 'video']));
  });

  it('has the official.company-live agentId', () => {
    expect(companyLiveDomainDescriptor.agentId).toBe('official.company-live');
  });
});
