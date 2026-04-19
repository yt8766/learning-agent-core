import { describe, expect, it } from 'vitest';

import { CommonService } from '../../src/common/common.service';

describe('CommonService', () => {
  it('returns a lightweight health payload', () => {
    const service = new CommonService();

    expect(service.getHealth()).toEqual({ ok: true });
  });
});
