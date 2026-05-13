import { describe, expect, it } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';
import { KnowledgeSettingsController } from '../../src/api/knowledge/knowledge-settings.controller';
import { IdentityAuthService } from '../../src/domains/identity/services/identity-auth.service';

describe('knowledge canonical routes', () => {
  it('mounts the main knowledge controller under knowledge', () => {
    expect(Reflect.getMetadata(PATH_METADATA, KnowledgeApiController)).toBe('knowledge');
  });

  it('mounts settings under knowledge settings', () => {
    expect(Reflect.getMetadata(PATH_METADATA, KnowledgeSettingsController)).toBe('knowledge/settings');
  });

  it('does not expose the removed knowledge v1 controller path from canonical controllers', () => {
    const routes = [
      Reflect.getMetadata(PATH_METADATA, KnowledgeApiController),
      Reflect.getMetadata(PATH_METADATA, KnowledgeSettingsController)
    ];

    expect(routes).not.toContain('knowledge/v1');
  });

  it('keeps identity auth injectable for bearer-token knowledge requests', () => {
    const dependencies = Reflect.getMetadata('design:paramtypes', KnowledgeApiController) as unknown[];

    expect(dependencies.at(-1)).toBe(IdentityAuthService);
  });
});
