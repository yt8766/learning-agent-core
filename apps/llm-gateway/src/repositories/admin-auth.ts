import type { AdminCredential, AdminPrincipal } from '../contracts/admin-auth';

export interface AdminAuthRepository {
  findOwnerPrincipal(): Promise<AdminPrincipal | null>;
  findPrincipalById(id: string): Promise<AdminPrincipal | null>;
  savePrincipal(principal: AdminPrincipal): Promise<void>;
  findPasswordCredential(principalId: string): Promise<AdminCredential | null>;
  saveCredential(credential: AdminCredential): Promise<void>;
}

export function createMemoryAdminAuthRepository(seed?: {
  principal?: AdminPrincipal;
  credential?: AdminCredential;
}): AdminAuthRepository {
  const principals = new Map<string, AdminPrincipal>();
  const credentials = new Map<string, AdminCredential>();

  if (seed?.principal) {
    principals.set(seed.principal.id, clonePrincipal(seed.principal));
  }

  if (seed?.credential) {
    credentials.set(seed.credential.principalId, cloneCredential(seed.credential));
  }

  return {
    async findOwnerPrincipal() {
      const principal = Array.from(principals.values()).find(record => record.role === 'owner') ?? null;
      return principal ? clonePrincipal(principal) : null;
    },
    async findPrincipalById(id) {
      const principal = principals.get(id);
      return principal ? clonePrincipal(principal) : null;
    },
    async savePrincipal(principal) {
      principals.set(principal.id, clonePrincipal(principal));
    },
    async findPasswordCredential(principalId) {
      const credential = credentials.get(principalId);
      return credential ? cloneCredential(credential) : null;
    },
    async saveCredential(credential) {
      credentials.set(credential.principalId, cloneCredential(credential));
    }
  };
}

function clonePrincipal(principal: AdminPrincipal): AdminPrincipal {
  return { ...principal };
}

function cloneCredential(credential: AdminCredential): AdminCredential {
  return { ...credential };
}
