import type { GatewaySnapshot } from '@agent/core';
import type { GatewayViewId } from './gateway-view-model';
import { renderGatewayPage } from './routes/gateway-page-wiring';
import type { GatewayPageData } from './routes/gateway-page-types';

export type { GatewayPageData } from './routes/gateway-page-types';

export function renderActivePage(activeView: GatewayViewId, snapshot: GatewaySnapshot, pageData: GatewayPageData) {
  return renderGatewayPage(activeView, { ...pageData, snapshot });
}
