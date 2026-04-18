import { z } from 'zod';

import { DeliveryCitationRecordSchema, DeliverySourceSummaryRecordSchema } from '../schemas/delivery.schema';

export type DeliveryCitationRecord = z.infer<typeof DeliveryCitationRecordSchema>;
export type DeliverySourceSummaryRecord = z.infer<typeof DeliverySourceSummaryRecordSchema>;
