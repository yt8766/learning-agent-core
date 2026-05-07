import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_METADATA = 'backend:required-permissions';

export function RequirePermission(...permissions: string[]) {
  return SetMetadata(REQUIRE_PERMISSION_METADATA, permissions);
}
