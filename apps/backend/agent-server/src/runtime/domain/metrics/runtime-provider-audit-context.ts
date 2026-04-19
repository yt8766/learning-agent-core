import { fetchProviderUsageAudit, type ProviderAuditSyncResult } from '@agent/runtime';
import type { RuntimeHost } from '../../core/runtime.host';

export function fetchProviderUsageAuditFromSettings(
  settings: RuntimeHost['settings'],
  days: number
): Promise<ProviderAuditSyncResult> {
  return fetchProviderUsageAudit(settings.providerAudit.adapters, settings.providerAudit.primaryProvider, days);
}
