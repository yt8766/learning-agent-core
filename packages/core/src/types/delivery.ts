import { z } from 'zod';

import { DeliveryCitationRecordSchema, DeliverySourceSummaryRecordSchema } from '../spec/delivery';

export type DeliveryCitationRecord = z.infer<typeof DeliveryCitationRecordSchema>;
export type DeliverySourceSummaryRecord = z.infer<typeof DeliverySourceSummaryRecordSchema>;
