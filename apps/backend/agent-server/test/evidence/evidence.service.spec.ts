import { describe, expect, it, vi } from 'vitest';

import { EvidenceService } from '../../src/evidence/evidence.service';

describe('EvidenceService', () => {
  it('delegates getCenter to RuntimeCentersService', () => {
    const runtimeCentersService = {
      getEvidenceCenter: vi.fn().mockReturnValue([{ id: 'evidence-1' }])
    };
    const service = new EvidenceService(runtimeCentersService as any);

    expect(service.getCenter()).toEqual([{ id: 'evidence-1' }]);
    expect(runtimeCentersService.getEvidenceCenter).toHaveBeenCalledTimes(1);
  });
});
