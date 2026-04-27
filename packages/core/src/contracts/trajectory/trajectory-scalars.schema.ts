import { z } from 'zod';

export const TrajectoryPublicIdSchema = z.string().min(1);
export const TrajectoryTimestampSchema = z.string().datetime();
