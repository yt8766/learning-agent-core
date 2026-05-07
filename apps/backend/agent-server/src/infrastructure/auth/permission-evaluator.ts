export interface BackendPrincipal {
  userId: string;
  roles: string[];
  permissions: string[];
  authSource: 'identity';
}

export function principalHasPermission(principal: BackendPrincipal, permission: string): boolean {
  if (principal.permissions.includes(permission)) {
    return true;
  }

  const [domain] = permission.split(':');
  return principal.permissions.includes(`${domain}:*`) || principal.permissions.includes('*:*');
}
