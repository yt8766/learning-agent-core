import type { WorkflowVersionRecord } from '@agent/core';
import type { WorkflowPresetDefinition } from '@agent/core';

import { GENERAL_PRESET, WORKFLOW_PRESETS } from './workflow-preset-definitions';

export interface WorkflowResolution {
  normalizedGoal: string;
  preset: WorkflowPresetDefinition;
  source: 'explicit' | 'inferred' | 'default';
  command?: string;
}

interface WorkflowResolutionOptions {
  constraints?: string[];
  context?: string;
}

export function listWorkflowPresets(): WorkflowPresetDefinition[] {
  return WORKFLOW_PRESETS;
}

export function listWorkflowVersions(): WorkflowVersionRecord[] {
  const updatedAt = new Date().toISOString();
  return WORKFLOW_PRESETS.map(preset => ({
    workflowId: preset.id,
    version: preset.version ?? '1.0.0',
    status: 'active',
    updatedAt,
    changelog: ['initial-registry-baseline']
  }));
}

export function resolveWorkflowPreset(goal: string, options?: WorkflowResolutionOptions): WorkflowResolution {
  const normalizedGoal = goal.trim();
  const constraints = options?.constraints ?? [];
  const prefersDiagnosis =
    constraints.includes('prefer-xingbu-diagnosis') || String(options?.context ?? '').includes('diagnosis_for:');
  if (prefersDiagnosis) {
    const diagnosisPreset = WORKFLOW_PRESETS.find(item => item.id === 'review') ?? GENERAL_PRESET;
    return {
      normalizedGoal,
      preset: diagnosisPreset,
      source: diagnosisPreset === GENERAL_PRESET ? 'default' : 'inferred'
    };
  }

  const explicit = normalizedGoal.match(/^(\/[a-z-]+)\b\s*(.*)$/i);
  if (explicit) {
    const command = (explicit[1] ?? '').toLowerCase();
    const preset = WORKFLOW_PRESETS.find(item => item.command === command) ?? GENERAL_PRESET;
    return {
      normalizedGoal: explicit[2]?.trim() || normalizedGoal,
      preset,
      source: preset === GENERAL_PRESET ? 'default' : 'explicit',
      command
    };
  }

  const lowered = normalizedGoal.toLowerCase();
  const inferred =
    WORKFLOW_PRESETS.find(
      item =>
        Boolean(item.command) &&
        !item.explicitOnly &&
        item.intentPatterns.some(pattern => lowered.includes(pattern.toLowerCase()))
    ) ?? GENERAL_PRESET;

  return {
    normalizedGoal,
    preset: inferred,
    source: inferred === GENERAL_PRESET ? 'default' : 'inferred'
  };
}
