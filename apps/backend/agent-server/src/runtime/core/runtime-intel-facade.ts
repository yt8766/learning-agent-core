/**
 * Intel facade — platform-runtime official intel assembly for backend schedulers.
 *
 * Backend runtime code routes intel job execution through this file so official
 * agent package wiring stays in platform-runtime instead of app modules.
 */
export {
  runIntelScheduledJob,
  type IntelScheduledJobRunResult,
  type RunIntelScheduledJobInput
} from '@agent/platform-runtime';
