import { runExternalCommand, type ExternalCommandResult } from './command-runner';

export interface SkillsCliCommandPlan {
  command: 'npx';
  args: string[];
}

export function runSkillsCliCommand(plan: SkillsCliCommandPlan): Promise<ExternalCommandResult> {
  return runExternalCommand({
    command: plan.command,
    args: plan.args,
    env: resolveSkillsCommandEnv(process.env),
    timeoutMs: 60_000
  });
}

export function resolveSkillsCommandEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    PATH: env.PATH,
    HOME: env.HOME,
    USER: env.USER,
    npm_config_registry: env.npm_config_registry
  };
}
