import { Alert } from 'antd';

import type { ChatCheckpointRecord } from '@/types/chat';

import { getWorkflowAlertDescriptors } from './chat-runtime-drawer-card-helpers';

export function WorkflowRoleAlerts({
  checkpoint,
  routeReason
}: {
  checkpoint?: ChatCheckpointRecord;
  routeReason?: string;
}) {
  return getWorkflowAlertDescriptors(checkpoint, routeReason).map(alert => (
    <Alert
      key={alert.key}
      style={{ marginTop: 12 }}
      type={alert.type}
      showIcon
      title={alert.title}
      description={alert.description}
    />
  ));
}
