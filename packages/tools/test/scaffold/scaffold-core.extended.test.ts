import { describe, expect, it } from 'vitest';

import {
  buildPackageScaffold,
  buildAgentScaffold,
  inspectScaffoldTarget,
  writeScaffoldBundle,
  listScaffoldTemplates
} from '../../src/scaffold/scaffold-core';

describe('scaffold-core extended coverage', () => {
  describe('listScaffoldTemplates', () => {
    it('returns at least package-lib and agent-basic templates', () => {
      const templates = listScaffoldTemplates();

      expect(templates.length).toBeGreaterThanOrEqual(2);
      expect(templates.some(t => t.id === 'package-lib')).toBe(true);
      expect(templates.some(t => t.id === 'agent-basic')).toBe(true);
    });
  });

  describe('buildPackageScaffold', () => {
    it('validates name must be kebab-case', async () => {
      await expect(buildPackageScaffold({ name: 'Not Valid' })).rejects.toThrow('kebab-case');
    });

    it('validates name must start with lowercase letter', async () => {
      await expect(buildPackageScaffold({ name: '-bad-name' })).rejects.toThrow('kebab-case');
    });

    it('builds a package scaffold with correct metadata', async () => {
      const bundle = await buildPackageScaffold({ name: 'test-coverage' });

      expect(bundle.hostKind).toBe('package');
      expect(bundle.name).toBe('test-coverage');
      expect(bundle.packageName).toBe('@agent/test-coverage');
      expect(bundle.templateId).toBe('package-lib');
      expect(bundle.files.length).toBeGreaterThan(0);
    });
  });

  describe('buildAgentScaffold', () => {
    it('builds an agent scaffold with correct metadata', async () => {
      const bundle = await buildAgentScaffold({ name: 'test-agent' });

      expect(bundle.hostKind).toBe('agent');
      expect(bundle.name).toBe('test-agent');
      expect(bundle.packageName).toBe('@agent/agents-test-agent');
      expect(bundle.templateId).toBe('agent-basic');
    });
  });

  describe('inspectScaffoldTarget', () => {
    it('reports canWriteSafely=true for non-existent directory', async () => {
      const bundle = await buildPackageScaffold({ name: 'inspect-test', mode: 'write' });
      const tmpDir = `/tmp/scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const inspection = await inspectScaffoldTarget({ bundle, targetRoot: tmpDir });

      expect(inspection.exists).toBe(false);
      expect(inspection.isEmpty).toBe(true);
      expect(inspection.canWriteSafely).toBe(true);
      expect(inspection.conflictingFiles).toEqual([]);
    });
  });

  describe('writeScaffoldBundle', () => {
    it('writes scaffold files to target directory', async () => {
      const tmpDir = `/tmp/scaffold-write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const bundle = await buildPackageScaffold({ name: 'write-test', mode: 'write' });

      const result = await writeScaffoldBundle({ bundle, targetRoot: tmpDir });

      expect(result.totalWritten).toBe(bundle.files.length);
      expect(result.writtenFiles.length).toBe(bundle.files.length);
      expect(result.skippedFiles).toEqual([]);
      expect(result.targetRoot).toBe(tmpDir);
    });
  });
});
