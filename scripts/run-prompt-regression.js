import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import {
  buildPromptRegressionSkipSummary,
  derivePromptRegressionSummary,
  enforcePromptRegressionGate,
  isSupportedPromptfooNodeRuntime
} from './prompt-regression.js';

const CONFIG_PATH = resolve('packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml');
const RAW_OUTPUT_PATH = resolve('packages/evals/promptfoo/latest-promptfoo-results.json');
const SUMMARY_PATH = resolve('packages/evals/promptfoo/latest-summary.json');
const PROMPTFOO_SUPPORTED_NODE_RANGE = '^20.20.0 || >=22.22.0';

async function main() {
  await mkdir(dirname(RAW_OUTPUT_PATH), { recursive: true });
  if (!isSupportedPromptfooNodeRuntime()) {
    buildPromptRegressionSkipSummary('unsupported_node_runtime', {
      detectedNodeVersion: process.versions.node,
      requiredNodeRange: PROMPTFOO_SUPPORTED_NODE_RANGE
    });
    console.warn(
      [
        `[prompt-regression] skipped: promptfoo requires Node ${PROMPTFOO_SUPPORTED_NODE_RANGE}.`,
        `Detected ${process.versions.node}.`,
        `Skip summaries are not written locally for unsupported runtimes.`
      ].join(' ')
    );
    return;
  }
  await runPromptfooEval();
  const raw = JSON.parse(await readFile(RAW_OUTPUT_PATH, 'utf8'));
  const summary = derivePromptRegressionSummary(raw);
  await writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf8');
  enforcePromptRegressionGate(summary);
  console.log(`Prompt regression summary written to ${SUMMARY_PATH}`);
}

function runPromptfooEval() {
  return spawnPromptfoo(['eval', '-c', CONFIG_PATH, '--output', RAW_OUTPUT_PATH]);
}

async function spawnPromptfoo(args) {
  try {
    await runCommand('promptfoo', args);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('ENOENT') && !message.includes('not found')) {
      throw error;
    }
  }

  try {
    await runCommand('pnpm', ['dlx', 'promptfoo@latest', ...args]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        'Unable to execute promptfoo.',
        'Tried `promptfoo` and `pnpm dlx promptfoo@latest`.',
        'Please install promptfoo globally or ensure network access is available for pnpm dlx.',
        `Details: ${message}`
      ].join(' ')
    );
  }
}

function runCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    child.on('error', error => {
      rejectPromise(error);
    });

    child.on('exit', code => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
