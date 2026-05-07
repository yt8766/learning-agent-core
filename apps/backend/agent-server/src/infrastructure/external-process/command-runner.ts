import { execFile } from 'node:child_process';

export interface ExternalCommandPlan {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface ExternalCommandResult {
  stdout: string;
  stderr: string;
}

export function runExternalCommand(plan: ExternalCommandPlan): Promise<ExternalCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      plan.command,
      plan.args,
      {
        env: plan.env,
        timeout: plan.timeoutMs ?? 60_000,
        maxBuffer: 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
          return;
        }

        resolve({ stdout, stderr });
      }
    );
  });
}
