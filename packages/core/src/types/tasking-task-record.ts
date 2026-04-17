import { z } from 'zod';

import { TaskRecordSchema } from '../spec/tasking-task-record';

export type TaskRecord = z.infer<typeof TaskRecordSchema>;
