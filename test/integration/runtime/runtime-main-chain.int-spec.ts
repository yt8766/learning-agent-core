/**
 * 第1类 integration：runtime 主链契约
 *
 * 验证 SubgraphId 原语、supervisor 元数据入口与 runtime graph factory 出口之间的协作一致性。
 *
 * 不依赖 LLM / DB / 外部服务，只做结构性和枚举一致性断言。
 *
 * 命名约定：*.int-spec.ts
 */

import { describe, expect, it } from 'vitest';

import {
  SubgraphIdSchema,
  SubgraphIdValues,
  WorkflowPresetDefinitionSchema,
  WorkflowVersionRecordSchema
} from '@agent/core';

import {
  listBootstrapSkills,
  listSubgraphDescriptors,
  listWorkflowPresets,
  listWorkflowVersions,
  resolveWorkflowPreset,
  resolveWorkflowRoute
} from '@agent/agents-supervisor';

import { createAgentGraph, createApprovalRecoveryGraph, createLearningGraph } from '@agent/runtime';

describe('runtime main chain contracts (第1类 integration)', () => {
  describe('SubgraphId primitives (core)', () => {
    it('SubgraphIdValues is a non-empty readonly tuple', () => {
      expect(SubgraphIdValues.length).toBeGreaterThan(0);
    });

    it('SubgraphIdSchema validates all values in SubgraphIdValues', () => {
      for (const id of SubgraphIdValues) {
        expect(() => SubgraphIdSchema.parse(id)).not.toThrow();
      }
    });

    it('SubgraphIdSchema rejects unknown subgraph id', () => {
      expect(() => SubgraphIdSchema.parse('data-report-sandpack')).toThrow();
    });

    it('SubgraphIdSchema rejects empty string', () => {
      expect(() => SubgraphIdSchema.parse('')).toThrow();
    });

    it('core SubgraphIdValues includes standard specialist subgraphs', () => {
      const ids = new Set(SubgraphIdValues);
      expect(ids.has('research')).toBe(true);
      expect(ids.has('execution')).toBe(true);
      expect(ids.has('review')).toBe(true);
    });
  });

  describe('listSubgraphDescriptors() (supervisor host)', () => {
    it('returns non-empty list', () => {
      const descriptors = listSubgraphDescriptors();
      expect(descriptors.length).toBeGreaterThan(0);
    });

    it('every descriptor has required fields: id, displayName, description, owner, entryNodes', () => {
      for (const d of listSubgraphDescriptors()) {
        expect(typeof d.id).toBe('string');
        expect(typeof d.displayName).toBe('string');
        expect(typeof d.description).toBe('string');
        expect(typeof d.owner).toBe('string');
        expect(Array.isArray(d.entryNodes)).toBe(true);
        expect(d.entryNodes.length).toBeGreaterThan(0);
      }
    });

    it('includes standard subgraph ids from SubgraphIdValues', () => {
      const descriptorIds = new Set(listSubgraphDescriptors().map(d => d.id));
      for (const id of SubgraphIdValues) {
        expect(descriptorIds.has(id)).toBe(true);
      }
    });

    it('platform-level subgraph ids are a superset of SubgraphIdValues (data-report specialization)', () => {
      const descriptorIds = new Set(listSubgraphDescriptors().map(d => d.id));
      // data-report subgraphs exist at platform level but not in core SubgraphIdValues
      // This is intentional: core SubgraphIdValues covers runtime execution subgraphs,
      // while data-report subgraphs are agent-specific specializations.
      expect(descriptorIds.size).toBeGreaterThanOrEqual(SubgraphIdValues.length);
    });

    it('descriptor ids are unique', () => {
      const ids = listSubgraphDescriptors().map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('listWorkflowPresets() (supervisor host)', () => {
    it('returns non-empty list', () => {
      const presets = listWorkflowPresets();
      expect(presets.length).toBeGreaterThan(0);
    });

    it('every preset passes WorkflowPresetDefinitionSchema parse', () => {
      for (const preset of listWorkflowPresets()) {
        expect(() => WorkflowPresetDefinitionSchema.parse(preset)).not.toThrow();
      }
    });

    it('every preset has unique id', () => {
      const ids = listWorkflowPresets().map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("includes the 'general' preset as default baseline", () => {
      const presets = listWorkflowPresets();
      const general = presets.find(p => p.id === 'general');
      expect(general).toBeDefined();
      expect(general?.approvalPolicy).toBeDefined();
    });

    it('every preset has outputContract with type and requiredSections', () => {
      for (const preset of listWorkflowPresets()) {
        expect(preset.outputContract).toBeDefined();
        expect(typeof preset.outputContract.type).toBe('string');
        expect(Array.isArray(preset.outputContract.requiredSections)).toBe(true);
      }
    });
  });

  describe('listWorkflowVersions() (supervisor host)', () => {
    it('returns non-empty list', () => {
      const versions = listWorkflowVersions();
      expect(versions.length).toBeGreaterThan(0);
    });

    it('every version passes WorkflowVersionRecordSchema parse', () => {
      for (const version of listWorkflowVersions()) {
        expect(() => WorkflowVersionRecordSchema.parse(version)).not.toThrow();
      }
    });
  });

  describe('resolveWorkflowPreset() (route integration)', () => {
    it('resolves "general" preset when goal matches intent pattern', () => {
      // resolveWorkflowPreset always returns a WorkflowResolution, never undefined.
      // 'general' as a goal falls back to the default GENERAL_PRESET.
      const result = resolveWorkflowPreset('通用');
      expect(result).toBeDefined();
      expect(result.preset.id).toBe('general');
      expect(result.source).toBeDefined();
    });

    it('always returns a WorkflowResolution (falls back to GENERAL_PRESET by default)', () => {
      // When goal doesn't match any command or intentPattern, the fallback is GENERAL_PRESET.
      const result = resolveWorkflowPreset('nonexistent-preset-xyz-unrecognized');
      expect(result).toBeDefined();
      expect(result.preset).toBeDefined();
      expect(result.source).toBe('default');
      expect(result.preset.id).toBe('general');
    });

    it('returns explicit source when goal uses a slash-command', () => {
      // Find first preset that has a command
      const presets = listWorkflowPresets();
      const withCommand = presets.find(p => p.command);
      if (!withCommand?.command) return; // skip if no command-based presets

      const result = resolveWorkflowPreset(withCommand.command);
      expect(result.source).toBe('explicit');
      expect(result.preset.id).toBe(withCommand.id);
    });
  });

  describe('resolveWorkflowRoute()', () => {
    it('is a callable function', () => {
      expect(typeof resolveWorkflowRoute).toBe('function');
    });
  });

  describe('listBootstrapSkills()', () => {
    it('returns an array', () => {
      const skills = listBootstrapSkills();
      expect(Array.isArray(skills)).toBe(true);
    });

    it('every skill has id and displayName', () => {
      for (const skill of listBootstrapSkills()) {
        expect(typeof skill.id).toBe('string');
        expect(typeof skill.displayName).toBe('string');
      }
    });
  });

  describe('runtime graph factory exports', () => {
    it('createAgentGraph is a callable function', () => {
      expect(typeof createAgentGraph).toBe('function');
    });

    it('createApprovalRecoveryGraph is a callable function', () => {
      expect(typeof createApprovalRecoveryGraph).toBe('function');
    });

    it('createLearningGraph is a callable function', () => {
      expect(typeof createLearningGraph).toBe('function');
    });
  });
});
