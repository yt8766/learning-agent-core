import { describe, expect, it } from 'vitest';

import {
  describeConnectorProfilePolicy,
  describeSkillSourceProfilePolicy,
  describeWorkerProfilePolicy
} from '../src/governance/profile-policy';

describe('profile-policy', () => {
  describe('describeSkillSourceProfilePolicy', () => {
    it('enables bundled-marketplace for personal profile', () => {
      const result = describeSkillSourceProfilePolicy('bundled-marketplace', 'personal', 'controlled');
      expect(result.enabledByProfile).toBe(true);
      expect(result.recommendedForProfiles).toContain('personal');
    });

    it('enables bundled-marketplace for open-web-allowed source policy', () => {
      const result = describeSkillSourceProfilePolicy('bundled-marketplace', 'company', 'open-web-allowed');
      expect(result.enabledByProfile).toBe(true);
    });

    it('disables bundled-marketplace for company profile without open-web', () => {
      const result = describeSkillSourceProfilePolicy('bundled-marketplace', 'company', 'controlled');
      expect(result.enabledByProfile).toBe(false);
      expect(result.reason).toContain('company');
    });

    it('enables internal sources for all profiles', () => {
      const result = describeSkillSourceProfilePolicy('internal-repo', 'company', 'controlled');
      expect(result.enabledByProfile).toBe(true);
      expect(result.recommendedForProfiles).toContain('platform');
      expect(result.recommendedForProfiles).toContain('personal');
    });
  });

  describe('describeConnectorProfilePolicy', () => {
    it('classifies lark connector as company-only', () => {
      const result = describeConnectorProfilePolicy('lark-mcp', 'company');
      expect(result.enabledByProfile).toBe(true);
      expect(result.recommendedForProfiles).not.toContain('personal');
    });

    it('disables company-only connector for personal profile', () => {
      const result = describeConnectorProfilePolicy('feishu-connector', 'personal');
      expect(result.enabledByProfile).toBe(false);
    });

    it('classifies security connector as company-only', () => {
      const result = describeConnectorProfilePolicy('security-scanner', 'platform');
      expect(result.enabledByProfile).toBe(true);
    });

    it('classifies jira connector as company-only', () => {
      const result = describeConnectorProfilePolicy('jira-mcp', 'company');
      expect(result.enabledByProfile).toBe(true);
    });

    it('classifies gmail connector as personal-only', () => {
      const result = describeConnectorProfilePolicy('gmail-mcp', 'personal');
      expect(result.enabledByProfile).toBe(true);
      expect(result.recommendedForProfiles).toContain('personal');
    });

    it('disables personal-only connector for company profile', () => {
      const result = describeConnectorProfilePolicy('notion-connector', 'company');
      expect(result.enabledByProfile).toBe(false);
    });

    it('enables personal-only connector for cli profile', () => {
      const result = describeConnectorProfilePolicy('local-mail', 'cli');
      expect(result.enabledByProfile).toBe(true);
    });

    it('enables generic connector for all profiles', () => {
      const result = describeConnectorProfilePolicy('web-search', 'company');
      expect(result.enabledByProfile).toBe(true);
      expect(result.recommendedForProfiles).toContain('platform');
      expect(result.recommendedForProfiles).toContain('personal');
    });

    it('classifies repo connector as company-only', () => {
      const result = describeConnectorProfilePolicy('github-repo', 'platform');
      expect(result.enabledByProfile).toBe(true);
    });

    it('classifies ci connector as company-only', () => {
      const result = describeConnectorProfilePolicy('ci-pipeline', 'company');
      expect(result.enabledByProfile).toBe(true);
    });
  });

  describe('describeWorkerProfilePolicy', () => {
    it('disables company worker for personal profile', () => {
      const result = describeWorkerProfilePolicy(
        { kind: 'company', displayName: 'Test Worker', requiredConnectors: [] } as any,
        'personal'
      );
      expect(result.enabledByProfile).toBe(false);
    });

    it('enables company worker for company profile', () => {
      const result = describeWorkerProfilePolicy(
        { kind: 'company', displayName: 'Test Worker', requiredConnectors: [] } as any,
        'company'
      );
      expect(result.enabledByProfile).toBe(true);
    });

    it('disables worker when required connector is unavailable', () => {
      // company worker with personal profile returns early with generic company reason
      const result1 = describeWorkerProfilePolicy(
        { kind: 'company', displayName: 'Test Worker', requiredConnectors: ['lark-mcp'] } as any,
        'personal'
      );
      expect(result1.enabledByProfile).toBe(false);

      // installed-skill worker with unavailable connector returns connector-specific reason
      const result2 = describeWorkerProfilePolicy(
        { kind: 'installed-skill', displayName: 'Skill Worker', requiredConnectors: ['lark-mcp'] } as any,
        'personal'
      );
      expect(result2.enabledByProfile).toBe(false);
      expect(result2.reason).toContain('lark-mcp');
    });

    it('enables installed-skill worker for all profiles', () => {
      const result = describeWorkerProfilePolicy(
        { kind: 'installed-skill', displayName: 'My Skill', requiredConnectors: [] } as any,
        'personal'
      );
      expect(result.enabledByProfile).toBe(true);
    });

    it('enables core worker for all profiles', () => {
      const result = describeWorkerProfilePolicy({ kind: 'core', displayName: 'Core Worker' } as any, 'company');
      expect(result.enabledByProfile).toBe(true);
      expect(result.reason).toContain('核心');
    });
  });
});
