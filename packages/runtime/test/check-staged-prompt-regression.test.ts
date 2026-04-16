import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolvePromptRegressionRun } from '../../../scripts/check-staged.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('check-staged prompt regression gating', () => {
  it('requires prompt regression for staged prompt-related files', () => {
    expect(
      resolvePromptRegressionRun(['agents/supervisor/src/flows/supervisor/prompts/supervisor-plan-prompts.ts'])
    ).toEqual({
      required: true,
      files: ['agents/supervisor/src/flows/supervisor/prompts/supervisor-plan-prompts.ts']
    });

    expect(resolvePromptRegressionRun(['packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml'])).toEqual({
      required: true,
      files: ['packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml']
    });
  });

  it('skips prompt regression for non-prompt-only staged files', () => {
    expect(resolvePromptRegressionRun(['docs/evals/promptfoo-regression.md'])).toEqual({
      required: false,
      files: []
    });
  });

  it('tracks prompt regression tooling changes as blocking inputs', () => {
    expect(resolvePromptRegressionRun(['scripts/run-prompt-regression.js'])).toEqual({
      required: true,
      files: ['scripts/run-prompt-regression.js']
    });
  });
});

describe('pr workflow prompt regression trigger', () => {
  it('watches prompt paths explicitly in the PR workflow', async () => {
    const workflow = await readFile(path.join(ROOT, '.github/workflows/pr-check.yml'), 'utf8');

    expect(workflow).toContain('agents:');
    expect(workflow).toContain("- 'agents/**'");
    expect(workflow).toContain('prompts:');
    expect(workflow).toContain("- 'agents/**/prompts/**'");
    expect(workflow).toContain("- 'packages/**/prompts/**'");
    expect(workflow).toContain("- 'apps/**/prompts/**'");
    expect(workflow).toContain("needs.detect-changes.outputs.prompts == 'true'");
  });
});
