export {
  groupConnectorDiscoveryHistory,
  groupGovernanceAuditByTarget,
  type RuntimeConnectorDiscoveryRecord,
  type RuntimeConnectorGovernanceAuditRecord
} from './runtime-connectors-center.helpers';

export function defaultConnectorSessionState(transport?: 'http' | 'stdio' | 'local-adapter' | 'cli') {
  if (transport === 'stdio') {
    return 'disconnected' as const;
  }
  return 'stateless' as const;
}
