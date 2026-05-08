export type ScheduledTaskRecord = {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  status: string;
  cwd: string;
  createdAt: string;
  source: 'sandbox-tool';
  cancelledAt?: string;
};

export type ScheduleRepository = {
  createSchedule(schedule: ScheduledTaskRecord): Promise<void>;
  listSchedules(): Promise<ScheduledTaskRecord[]>;
  readSchedule(id: string): Promise<ScheduledTaskRecord>;
  updateSchedule(schedule: ScheduledTaskRecord): Promise<void>;
};

export function createInMemoryScheduleRepository(): ScheduleRepository {
  const schedules = new Map<string, ScheduledTaskRecord>();
  return {
    async createSchedule(schedule) {
      schedules.set(schedule.id, schedule);
    },
    async listSchedules() {
      return [...schedules.values()];
    },
    async readSchedule(id) {
      const schedule = schedules.get(id);
      if (!schedule) {
        throw new Error(`Scheduled task ${id} was not found.`);
      }
      return schedule;
    },
    async updateSchedule(schedule) {
      schedules.set(schedule.id, schedule);
    }
  };
}

const defaultScheduleRepository = createInMemoryScheduleRepository();

export function getDefaultScheduleRepository(): ScheduleRepository {
  return defaultScheduleRepository;
}
