import { z } from 'zod';

import { TaskRecordSchema } from '../schemas/task-record';

export type TaskRecord = z.infer<typeof TaskRecordSchema>;
