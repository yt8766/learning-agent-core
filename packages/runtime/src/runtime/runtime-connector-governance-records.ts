export {
  groupConnectorDiscoveryHistory,
  groupGovernanceAuditByTarget,
  type RuntimeConnectorDiscoveryRecord,
  type RuntimeConnectorGovernanceAuditRecord
} from './runtime-connectors-center.helpers';

export function defaultConnectorSessionState(transport?: 'http' | 'stdio' | 'local-adapter') {
  if (transport === 'stdio') {
    return 'disconnected' as const;
  }
  return 'stateless' as const;
}
