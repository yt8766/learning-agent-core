import { describe, expect, it } from 'vitest';

import { AppController } from '../../../apps/backend/agent-server/src/app/app.controller';
import { AppFeatureModule } from '../../../apps/backend/agent-server/src/app/app.module';
import { ChatController } from '../../../apps/backend/agent-server/src/chat/chat.controller';
import { ChatModule } from '../../../apps/backend/agent-server/src/chat/chat.module';
import { RuntimeModule } from '../../../apps/backend/agent-server/src/runtime/runtime.module';
import { RuntimeSessionService } from '../../../apps/backend/agent-server/src/runtime/services/runtime-session.service';
import { RuntimeTaskService } from '../../../apps/backend/agent-server/src/runtime/services/runtime-task.service';

describe('backend Nest module smoke', () => {
  it('keeps app and chat modules wired to runtime providers', () => {
    expect(readModuleMetadata(AppFeatureModule, 'controllers')).toContain(AppController);
    expect(readModuleMetadata(AppFeatureModule, 'imports')).toContain(RuntimeModule);
    expect(readModuleMetadata(ChatModule, 'controllers')).toContain(ChatController);
    expect(readModuleMetadata(ChatModule, 'imports')).toContain(RuntimeModule);
  });

  it('keeps RuntimeModule export surface available for backend feature modules', () => {
    expect(readModuleMetadata(RuntimeModule, 'exports')).toContain(RuntimeSessionService);
    expect(readModuleMetadata(RuntimeModule, 'exports')).toContain(RuntimeTaskService);
  });
});

function readModuleMetadata(moduleClass: object, key: 'imports' | 'controllers' | 'exports') {
  return (Reflect.getMetadata(key, moduleClass) ?? []) as unknown[];
}
