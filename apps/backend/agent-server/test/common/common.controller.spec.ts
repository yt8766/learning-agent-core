import { describe, expect, it } from 'vitest';

import { CommonController } from '../../src/common/common.controller';
import { CommonService } from '../../src/common/common.service';

describe('CommonController', () => {
  it('returns health payload from the service', () => {
    const service = new CommonService();
    const controller = new CommonController(service);

    expect(controller.getHealth()).toEqual({ ok: true });
  });
});
