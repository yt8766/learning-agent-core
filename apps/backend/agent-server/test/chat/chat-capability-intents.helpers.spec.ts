import { describe, expect, it } from 'vitest';

import {
  resolveCapabilityIntent,
  buildSkillCatalogSummary,
  buildToolsCatalogSummary,
  groupSkillCards,
  buildDefaultConnectorConfig,
  buildTemplatePlaceholder
} from '../../src/chat/chat-capability-intents.helpers';

describe('resolveCapabilityIntent', () => {
  it('returns none for unmatched messages', () => {
    expect(resolveCapabilityIntent('hello world')).toEqual({ kind: 'none' });
  });

  it('detects list-tools intent with Chinese', () => {
    expect(resolveCapabilityIntent('我现在有哪些工具').kind).toBe('list-tools');
  });

  it('detects list-tools intent with English', () => {
    expect(resolveCapabilityIntent('list all tools').kind).toBe('list-tools');
  });

  it('detects list-tools intent with current tools phrasing', () => {
    expect(resolveCapabilityIntent('当前有什么工具可以用').kind).toBe('list-tools');
  });

  it('detects list-skills intent with Chinese', () => {
    expect(resolveCapabilityIntent('我现在有哪些技能').kind).toBe('list-skills');
  });

  it('detects list-skills intent with English', () => {
    expect(resolveCapabilityIntent('show me skills').kind).toBe('list-skills');
  });

  it('detects list-connectors intent with Chinese', () => {
    expect(resolveCapabilityIntent('列出当前有哪些连接器').kind).toBe('list-connectors');
  });

  it('detects list-connectors intent with English', () => {
    expect(resolveCapabilityIntent('list mcp connectors').kind).toBe('list-connectors');
  });

  it('detects list-capabilities when tools and skills mentioned together', () => {
    expect(resolveCapabilityIntent('列出工具和技能').kind).toBe('list-capabilities');
  });

  it('detects list-capabilities when tools and connectors mentioned together', () => {
    expect(resolveCapabilityIntent('列出工具和连接器').kind).toBe('list-capabilities');
  });

  it('detects list-capabilities with tools/skills slash pattern', () => {
    expect(resolveCapabilityIntent('tools/skills').kind).toBe('list-capabilities');
  });

  it('detects install-skill intent with npx command', () => {
    const result = resolveCapabilityIntent('安装 skill npx skills add org/repo --skill my-skill');
    expect(result.kind).toBe('install-skill');
    if (result.kind === 'install-skill') {
      expect(result.repo).toBe('org/repo');
      expect(result.skillName).toBe('my-skill');
    }
  });

  it('detects install-skill intent with github URL', () => {
    const result = resolveCapabilityIntent('安装这个技能 https://github.com/org/repo');
    expect(result.kind).toBe('install-skill');
    if (result.kind === 'install-skill') {
      expect(result.repo).toBe('org/repo');
    }
  });

  it('detects install-skill intent with repo/skill pattern', () => {
    const result = resolveCapabilityIntent('帮我安装 org/repo@v1 技能');
    expect(result.kind).toBe('install-skill');
    if (result.kind === 'install-skill') {
      expect(result.repo).toBe('org/repo');
      expect(result.skillName).toBe('v1');
    }
  });

  it('detects create-skill intent', () => {
    const result = resolveCapabilityIntent('create skill for data analysis');
    expect(result.kind).toBe('create-skill');
    if (result.kind === 'create-skill') {
      expect(result.description).toBeTruthy();
    }
  });

  it('detects create-skill with quoted displayName', () => {
    const result = resolveCapabilityIntent('create skill "Data Analyst"');
    expect(result.kind).toBe('create-skill');
    if (result.kind === 'create-skill') {
      expect(result.displayName).toBe('Data Analyst');
    }
  });

  it('detects create-skill intent with English', () => {
    const result = resolveCapabilityIntent('create a skill for data analysis');
    expect(result.kind).toBe('create-skill');
  });

  it('detects use-connector for github', () => {
    const result = resolveCapabilityIntent('配置接入 github mcp connector');
    expect(result.kind).toBe('use-connector');
    if (result.kind === 'use-connector') {
      expect(result.connectorQuery).toBe('github');
      expect(result.templateId).toBe('github-mcp-template');
      expect(result.label).toBe('GitHub MCP');
    }
  });

  it('detects use-connector for browser', () => {
    const result = resolveCapabilityIntent('使用 browser mcp connector');
    expect(result.kind).toBe('use-connector');
    if (result.kind === 'use-connector') {
      expect(result.connectorQuery).toBe('browser');
      expect(result.templateId).toBe('browser-mcp-template');
      expect(result.label).toBe('Browser MCP');
    }
  });

  it('detects use-connector for lark', () => {
    const result = resolveCapabilityIntent('连接 lark connector');
    expect(result.kind).toBe('use-connector');
    if (result.kind === 'use-connector') {
      expect(result.connectorQuery).toBe('lark');
      expect(result.templateId).toBe('lark-mcp-template');
      expect(result.label).toBe('Lark MCP');
    }
  });
});

describe('buildSkillCatalogSummary', () => {
  it('builds summary with counts', () => {
    const result = buildSkillCatalogSummary(5, 3);
    expect(result).toContain('5');
    expect(result).toContain('3');
  });
});

describe('buildToolsCatalogSummary', () => {
  it('returns empty message when no tools', () => {
    expect(buildToolsCatalogSummary({ totalTools: 0, families: [], tools: [] })).toContain('还没有');
  });

  it('builds summary with readonly and approval counts', () => {
    const result = buildToolsCatalogSummary({
      totalTools: 10,
      families: [
        { id: 'f1', displayName: 'Family 1', toolCount: 5 },
        { id: 'f2', displayName: 'Family 2', toolCount: 3 },
        { id: 'f3', displayName: 'Family 3', toolCount: 1 },
        { id: 'f4', displayName: 'Family 4', toolCount: 1 }
      ],
      tools: [
        { isReadOnly: true, requiresApproval: false },
        { isReadOnly: true, requiresApproval: false },
        { isReadOnly: false, requiresApproval: true }
      ],
      approvalRequiredCount: 1
    });
    expect(result).toContain('10');
    expect(result).toContain('2');
    expect(result).toContain('1');
  });

  it('uses tool filter for approval count when approvalRequiredCount is not set', () => {
    const result = buildToolsCatalogSummary({
      totalTools: 3,
      families: [{ id: 'f1', displayName: 'Family 1' }],
      tools: [{ requiresApproval: true }, { requiresApproval: true }, { requiresApproval: false }]
    });
    expect(result).toContain('2');
  });

  it('shows "no approval needed" when approval count is 0', () => {
    const result = buildToolsCatalogSummary({
      totalTools: 3,
      families: [{ id: 'f1' }],
      tools: [{ isReadOnly: true }]
    });
    expect(result).toContain('未发现');
  });

  it('truncates family preview to 4 and shows extra count', () => {
    const families = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, displayName: `Family ${i}` }));
    const result = buildToolsCatalogSummary({
      totalTools: 10,
      families,
      tools: []
    });
    expect(result).toContain('6 类');
  });

  it('uses family id when displayName is missing', () => {
    const result = buildToolsCatalogSummary({
      totalTools: 1,
      families: [{ id: 'my-family' }],
      tools: []
    });
    expect(result).toContain('my-family');
  });

  it('omits family text when no families', () => {
    const result = buildToolsCatalogSummary({
      totalTools: 1,
      families: [],
      tools: []
    });
    expect(result).toContain('1 个工具');
  });
});

describe('groupSkillCards', () => {
  it('groups bootstrap skills as shared', () => {
    const result = groupSkillCards([{ id: 's1', name: 'Skill 1', description: 'test', bootstrap: true }]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Shared Skills');
    expect(result[0].items[0].bootstrap).toBe(true);
  });

  it('groups by ownership ownerType', () => {
    const result = groupSkillCards([
      { id: 's1', name: 'Skill 1', description: 'test', ownership: { ownerType: 'ministry-owned', scope: 'ministry' } }
    ]);
    expect(result[0].label).toBe('Ministry-owned');
  });

  it('groups specialist-owned skills', () => {
    const result = groupSkillCards([
      {
        id: 's1',
        name: 'Skill 1',
        description: 'test',
        ownership: { ownerType: 'specialist-owned', scope: 'specialist' }
      }
    ]);
    expect(result[0].label).toBe('Specialist-owned');
  });

  it('derives runtime-derived from installReceiptId', () => {
    const result = groupSkillCards([{ id: 's1', name: 'Skill 1', description: 'test', installReceiptId: 'r1' }]);
    expect(result[0].label).toBe('Runtime-derived');
  });

  it('defaults to user-attached when no special attributes', () => {
    const result = groupSkillCards([{ id: 's1', name: 'Skill 1', description: 'test' }]);
    expect(result[0].label).toBe('User-attached');
  });

  it('marks disabled skills as not enabled', () => {
    const result = groupSkillCards([{ id: 's1', name: 'Skill 1', description: 'test', status: 'disabled' }]);
    expect(result[0].items[0].enabled).toBe(false);
  });

  it('generates key from label', () => {
    const result = groupSkillCards([{ id: 's1', name: 'Skill 1', description: 'test', bootstrap: true }]);
    expect(result[0].key).toBe('shared-skills');
  });
});

describe('buildDefaultConnectorConfig', () => {
  it('returns github config', () => {
    const config = buildDefaultConnectorConfig('github-mcp-template');
    expect(config.templateId).toBe('github-mcp-template');
    expect(config.transport).toBe('stdio');
    expect(config.displayName).toBe('GitHub MCP');
    expect(config.enabled).toBe(true);
  });

  it('returns browser config', () => {
    const config = buildDefaultConnectorConfig('browser-mcp-template');
    expect(config.templateId).toBe('browser-mcp-template');
    expect(config.transport).toBe('stdio');
    expect(config.displayName).toBe('Browser MCP');
    expect(config.enabled).toBe(true);
  });

  it('returns lark config with empty endpoint/key when no hints', () => {
    const config = buildDefaultConnectorConfig('lark-mcp-template');
    expect(config.templateId).toBe('lark-mcp-template');
    expect(config.transport).toBe('http');
    expect(config.displayName).toBe('Lark MCP');
    expect(config.enabled).toBe(false);
  });

  it('extracts endpoint and api key from raw message for lark', () => {
    const config = buildDefaultConnectorConfig('lark-mcp-template', 'endpoint=https://lark.example.com token=abc123');
    expect(config.endpoint).toBe('https://lark.example.com');
    expect(config.apiKey).toBe('abc123');
    expect(config.enabled).toBe(true);
  });

  it('extracts endpoint from URL pattern in lark message', () => {
    const config = buildDefaultConnectorConfig('lark-mcp-template', '使用 https://lark.example.com/mcp api_key=my-key');
    expect(config.endpoint).toBe('https://lark.example.com/mcp');
    expect(config.apiKey).toBe('my-key');
    expect(config.enabled).toBe(true);
  });
});

describe('buildTemplatePlaceholder', () => {
  it('builds placeholder from intent', () => {
    const result = buildTemplatePlaceholder({ connectorQuery: 'github', label: 'GitHub MCP' });
    expect(result.id).toBe('github-mcp-template');
    expect(result.displayName).toBe('GitHub MCP');
    expect(result.summary).toContain('GitHub MCP');
  });
});
