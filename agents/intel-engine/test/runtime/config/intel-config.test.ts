import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadIntelConfigSet } from '../../../src/runtime/config/intel-config-loader';

describe('loadIntelConfigSet', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('loads sources, channels, and routes from YAML files', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'intel-config-'));
    tempDirs.push(configDir);

    await writeFile(
      join(configDir, 'sources.yaml'),
      `
defaults:
  recency_hours: 48
topics:
  - key: frontend_security
    enabled: true
    mode: patrol
    priority_default: P1
    queries:
      - axios vulnerability
`,
      'utf8'
    );
    await writeFile(
      join(configDir, 'channels.yaml'),
      `
channels:
  security_alert:
    name: 安全告警群
    type: lark_webhook
    webhook_env: LARK_WEBHOOK_SECURITY_ALERT
    enabled: true
`,
      'utf8'
    );
    await writeFile(
      join(configDir, 'routes.yaml'),
      `
defaults:
  suppress_duplicate_hours: 24
rules:
  - id: frontend-security-critical
    enabled: true
    when:
      category_in: [frontend_security]
      priority_in: [P0]
      status_in: [confirmed]
    send_to: [security_alert]
    template: security_alert_full
`,
      'utf8'
    );

    const configSet = await loadIntelConfigSet(configDir);
    const securityAlertChannel = configSet.channels.channels.security_alert;

    expect(configSet.sources.topics).toHaveLength(1);
    expect(securityAlertChannel).toBeDefined();
    expect(securityAlertChannel?.webhookEnv).toBe('LARK_WEBHOOK_SECURITY_ALERT');
    expect(configSet.routes.rules[0]?.sendTo).toEqual(['security_alert']);
  });
});
