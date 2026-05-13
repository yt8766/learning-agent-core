import { describe, expect, it } from 'vitest';

import { parsePromptfooConfigSummary } from '../../../src/runtime/helpers/prompt-regression-summary';

describe('parsePromptfooConfigSummary', () => {
  it('parses prompts, providers, and tests sections', () => {
    const raw = `prompts:
  - id: "suite-a-v1"
    label: "Suite A v1"
  - id: "suite-a-v2"
    label: "Suite A v2"
  - id: "suite-b-v1"
    label: "Suite B v1"

providers:
  - id: "openai/gpt-4"
  - id: "anthropic/claude-3"

tests:
  - vars:
      input: "test1"
  - vars:
      input: "test2"
  - vars:
      input: "test3"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.prompts).toHaveLength(3);
    expect(result.providerCount).toBe(2);
    expect(result.testCount).toBe(3);
    expect(result.suites).toHaveLength(2);
  });

  it('handles prompts without labels', () => {
    const raw = `prompts:
  - id: "my-suite-v1"
  - id: "my-suite-v2"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.prompts).toHaveLength(2);
    expect(result.suites).toHaveLength(1);
    expect(result.suites[0].label).toBe('my-suite');
  });

  it('handles empty input', () => {
    const result = parsePromptfooConfigSummary('');
    expect(result.prompts).toHaveLength(0);
    expect(result.providerCount).toBe(0);
    expect(result.testCount).toBe(0);
    expect(result.suites).toHaveLength(0);
  });

  it('skips comments and empty lines', () => {
    const raw = `# This is a comment

prompts:
  - id: "test-v1"

# Another comment

providers:
  - id: "provider-1"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.prompts).toHaveLength(1);
    expect(result.providerCount).toBe(1);
  });

  it('handles prompts with quoted ids', () => {
    const raw = `prompts:
  - id: "quoted-id-v1"
    label: "Quoted Label v1"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.prompts[0].id).toBe('quoted-id-v1');
  });

  it('groups prompts into suites by version suffix', () => {
    const raw = `prompts:
  - id: "analysis-v1"
    label: "Analysis v1"
  - id: "analysis-v2"
    label: "Analysis v2"
  - id: "analysis-v3"
    label: "Analysis v3"
  - id: "review-v1"
    label: "Review v1"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.suites).toHaveLength(2);
    const analysisSuite = result.suites.find(s => s.suiteId === 'analysis');
    expect(analysisSuite).toBeDefined();
    expect(analysisSuite!.promptCount).toBe(3);
    expect(analysisSuite!.versions).toEqual(['v1', 'v2', 'v3']);
  });

  it('handles prompts without version suffix', () => {
    const raw = `prompts:
  - id: "standalone"
    label: "Standalone Prompt"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.suites).toHaveLength(1);
    expect(result.suites[0].versions).toEqual(['standalone']);
  });

  it('deduplicates versions', () => {
    const raw = `prompts:
  - id: "dup-v1"
  - id: "dup-v1"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.suites[0].versions).toEqual(['v1']);
  });

  it('handles label without version for suite label derivation', () => {
    const raw = `prompts:
  - id: "no-label-suite-v1"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.suites[0].label).toBe('no-label-suite');
  });

  it('strips version from label', () => {
    const raw = `prompts:
  - id: "my-suite-v2"
    label: "My Suite v2 extra"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.suites[0].label).toBe('My Suite');
  });

  it('handles multiple test sections', () => {
    const raw = `prompts:
  - id: "p1-v1"

tests:
  - vars:
      a: 1
  - vars:
      b: 2
  - vars:
      c: 3
  - vars:
      d: 4
  - vars:
      e: 5
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.testCount).toBe(5);
  });

  it('handles providers without matching section', () => {
    const raw = `prompts:
  - id: "p1-v1"

providers:
  - id: "gpt-4"
  - id: "claude-3"
  - id: "gemini-pro"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.providerCount).toBe(3);
  });

  it('sorts suites by label', () => {
    const raw = `prompts:
  - id: "zebra-v1"
    label: "Zebra"
  - id: "alpha-v1"
    label: "Alpha"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.suites[0].label).toBe('Alpha');
    expect(result.suites[1].label).toBe('Zebra');
  });

  it('handles non-matching lines gracefully', () => {
    const raw = `prompts:
  - id: "p1-v1"
    label: "P1"
  some random line
  - id: "p2-v1"
    label: "P2"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.prompts).toHaveLength(2);
  });

  it('ignores tests section items without vars', () => {
    const raw = `prompts:
  - id: "p1-v1"

tests:
  - description: "not a test var"
  - vars:
      input: "real test"
`;
    const result = parsePromptfooConfigSummary(raw);
    expect(result.testCount).toBe(1);
  });
});
