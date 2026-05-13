import { describe, expect, it } from 'vitest';

import {
  maskSecret,
  normalizeLimit,
  providerTypeToKind,
  inferAuthFileProviderKind,
  createMemoryAuthFile,
  projectMemoryLogs,
  createMemoryManagementApiCall,
  createMemoryProviderConfigs,
  createMemoryAuthFiles,
  createMemoryLogs,
  createMemoryQuotaDetails,
  createMemorySystemModels
} from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client.helpers';

describe('memory-agent-gateway-management-client helpers', () => {
  describe('maskSecret', () => {
    it('masks long secrets', () => {
      expect(maskSecret('sk-1234567890')).toBe('sk-***890');
    });

    it('returns *** for short secrets', () => {
      expect(maskSecret('abc')).toBe('***');
      expect(maskSecret('12345')).toBe('***');
    });

    it('masks exactly 6 char secret', () => {
      expect(maskSecret('abcdef')).toBe('abc***def');
    });
  });

  describe('normalizeLimit', () => {
    it('returns value when valid', () => {
      expect(normalizeLimit(50, 100, 500)).toBe(50);
    });

    it('caps at max', () => {
      expect(normalizeLimit(1000, 100, 500)).toBe(500);
    });

    it('returns fallback for undefined', () => {
      expect(normalizeLimit(undefined, 100, 500)).toBe(100);
    });

    it('returns fallback for 0', () => {
      expect(normalizeLimit(0, 100, 500)).toBe(100);
    });

    it('returns fallback for negative', () => {
      expect(normalizeLimit(-5, 100, 500)).toBe(100);
    });

    it('returns fallback for Infinity', () => {
      expect(normalizeLimit(Infinity, 100, 500)).toBe(100);
    });

    it('returns fallback for NaN', () => {
      expect(normalizeLimit(NaN, 100, 500)).toBe(100);
    });

    it('floors decimal values', () => {
      expect(normalizeLimit(49.7, 100, 500)).toBe(49);
    });
  });

  describe('providerTypeToKind', () => {
    it('returns openai-compatible for openaiCompatible', () => {
      expect(providerTypeToKind('openaiCompatible')).toBe('openai-compatible');
    });

    it('returns the value for other types', () => {
      expect(providerTypeToKind('gemini')).toBe('gemini');
      expect(providerTypeToKind('claude')).toBe('claude');
      expect(providerTypeToKind('codex')).toBe('codex');
    });

    it('returns custom for undefined', () => {
      expect(providerTypeToKind(undefined)).toBe('custom');
    });
  });

  describe('inferAuthFileProviderKind', () => {
    it('detects gemini', () => {
      expect(inferAuthFileProviderKind('gemini-auth.json')).toBe('gemini');
      expect(inferAuthFileProviderKind('GEMINI_KEY')).toBe('gemini');
    });

    it('detects codex', () => {
      expect(inferAuthFileProviderKind('codex-auth.json')).toBe('codex');
    });

    it('detects claude', () => {
      expect(inferAuthFileProviderKind('claude-auth.json')).toBe('claude');
    });

    it('detects anthropic', () => {
      expect(inferAuthFileProviderKind('anthropic-auth.json')).toBe('claude');
    });

    it('detects vertex', () => {
      expect(inferAuthFileProviderKind('vertex-auth.json')).toBe('vertex');
    });

    it('detects ampcode', () => {
      expect(inferAuthFileProviderKind('ampcode-auth.json')).toBe('ampcode');
    });

    it('returns custom for unknown', () => {
      expect(inferAuthFileProviderKind('unknown-auth.json')).toBe('custom');
    });

    it('is case insensitive', () => {
      expect(inferAuthFileProviderKind('Gemini-Auth.json')).toBe('gemini');
      expect(inferAuthFileProviderKind('CLAUDE.json')).toBe('claude');
    });
  });

  describe('createMemoryAuthFile', () => {
    it('creates auth file with inferred provider kind', () => {
      const result = createMemoryAuthFile('gemini-auth.json');
      expect(result.providerKind).toBe('gemini');
      expect(result.providerId).toBe('gemini');
      expect(result.fileName).toBe('gemini-auth.json');
      expect(result.status).toBe('valid');
    });

    it('creates custom auth file', () => {
      const result = createMemoryAuthFile('unknown.json');
      expect(result.providerKind).toBe('custom');
    });
  });

  describe('projectMemoryLogs', () => {
    const logs = createMemoryLogs();

    it('returns all logs when no filters', () => {
      const result = projectMemoryLogs(logs, {});
      expect(result.items).toHaveLength(2);
    });

    it('filters by hideManagementTraffic', () => {
      const result = projectMemoryLogs(logs, { hideManagementTraffic: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].managementTraffic).toBe(false);
    });

    it('filters by query matching message', () => {
      const result = projectMemoryLogs(logs, { query: 'proxy' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].message).toContain('proxy');
    });

    it('filters by query matching path', () => {
      const result = projectMemoryLogs(logs, { query: '/config' });
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('filters by query matching method', () => {
      const result = projectMemoryLogs(logs, { query: 'POST' });
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('filters by query matching statusCode', () => {
      const result = projectMemoryLogs(logs, { query: '200' });
      expect(result.items).toHaveLength(2);
    });

    it('filters by after timestamp', () => {
      const result = projectMemoryLogs(logs, { after: '2026-05-08T00:00:00.000Z' });
      expect(result.items).toHaveLength(0);
    });

    it('limits results', () => {
      const result = projectMemoryLogs(logs, { limit: 1 });
      expect(result.items).toHaveLength(1);
    });

    it('trims query whitespace', () => {
      const result = projectMemoryLogs(logs, { query: '  proxy  ' });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('createMemoryManagementApiCall', () => {
    it('creates response from request', () => {
      const result = createMemoryManagementApiCall({
        providerKind: 'gemini',
        method: 'GET',
        path: '/quota',
        header: {}
      });
      expect(result.ok).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('uses url fallback for path', () => {
      const result = createMemoryManagementApiCall({
        providerKind: 'gemini',
        method: 'GET',
        url: '/models',
        header: {}
      });
      expect(result.ok).toBe(true);
      const body = JSON.parse(result.bodyText);
      expect(body.path).toBe('/models');
    });
  });

  describe('factory functions', () => {
    it('createMemoryProviderConfigs returns gemini config', () => {
      const result = createMemoryProviderConfigs();
      expect(result.get('gemini')).toBeDefined();
      expect(result.get('gemini')!.providerType).toBe('gemini');
    });

    it('createMemoryAuthFiles returns gemini auth file', () => {
      const result = createMemoryAuthFiles();
      expect(result.get('memory-gemini.json')).toBeDefined();
    });

    it('createMemoryLogs returns proxy and management logs', () => {
      const result = createMemoryLogs();
      expect(result).toHaveLength(2);
      expect(result[0].managementTraffic).toBe(false);
      expect(result[1].managementTraffic).toBe(true);
    });

    it('createMemoryQuotaDetails returns quota', () => {
      const result = createMemoryQuotaDetails();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].providerId).toBe('claude');
    });

    it('createMemorySystemModels returns groups', () => {
      const result = createMemorySystemModels();
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].models).toHaveLength(1);
    });
  });
});
