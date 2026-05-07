import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { ConnectorsCenterController } from '../../src/platform/connectors-center.controller';
import { PlatformModule } from '../../src/platform/platform.module';
import { SkillSourcesCenterController } from '../../src/platform/skill-sources-center.controller';
import { REQUIRE_PERMISSION_METADATA } from '../../src/infrastructure/auth/decorators/require-permission.decorator';
import { PermissionGuard } from '../../src/infrastructure/auth/guards/permission.guard';

const GOVERNANCE_WRITE = ['governance:write'];

describe('platform permission guards', () => {
  it('requires governance write permission for connector mutation routes', () => {
    expectRequiredPermissions(ConnectorsCenterController, [
      'enableConnector',
      'disableConnector',
      'setConnectorPolicy',
      'clearConnectorPolicy',
      'setCapabilityPolicy',
      'clearCapabilityPolicy',
      'closeConnectorSession',
      'refreshConnectorDiscovery',
      'configureConnector'
    ]);
  });

  it('requires governance write permission for skill source mutation routes', () => {
    expectRequiredPermissions(SkillSourcesCenterController, [
      'installSkill',
      'installRemoteSkill',
      'checkInstalledSkills',
      'updateInstalledSkills',
      'enableSkillSource',
      'disableSkillSource',
      'syncSkillSource',
      'approveSkillInstall',
      'rejectSkillInstall'
    ]);
  });

  it('registers the permission guard for platform controllers', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PlatformModule) as unknown[];

    expect(providers).toContainEqual({
      provide: APP_GUARD,
      useClass: PermissionGuard
    });
  });
});

function expectRequiredPermissions(controller: new (...args: never[]) => unknown, methodNames: string[]) {
  for (const methodName of methodNames) {
    const handler = controller.prototype[methodName] as unknown;
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_METADATA, handler), methodName).toEqual(GOVERNANCE_WRITE);
  }
}
