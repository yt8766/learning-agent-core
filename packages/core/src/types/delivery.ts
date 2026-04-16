import type { TrustClass } from '@agent/shared';

export interface DeliveryCitationRecord {
  label: string;
  sourceUrl?: string;
  sourceType?: string;
  trustClass?: TrustClass | string;
  summary?: string;
}

export interface DeliverySourceSummaryRecord {
  freshnessSourceSummary?: string;
  citationSourceSummary?: string;
  citations?: DeliveryCitationRecord[];
}
