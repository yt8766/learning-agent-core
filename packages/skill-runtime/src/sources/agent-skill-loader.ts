import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type SkillManifestRecord,
  type SkillSourceRecord,
  type SpecialistDomain,
  type WorkerDomain
} from '@agent/core';

const PRIORITY_ORDER = ['bundled/marketplace', 'managed/local', 'workspace/internal'] as const;

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(raw: string): { attributes: Record<string, unknown>; body: string } {
  if (!raw.startsWith('---\n')) {
    return { attributes: {}, body: raw.trim() };
  }

  const endMarker = raw.indexOf('\n---\n', 4);
  if (endMarker < 0) {
    return { attributes: {}, body: raw.trim() };
  }

  const frontmatter = raw.slice(4, endMarker).split(/\r?\n/);
  const body = raw.slice(endMarker + 5).trim();
  const attributes: Record<string, unknown> = {};
  let activeMapKey: string | undefined;
  let activeListKey: string | undefined;

  for (const line of frontmatter) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const listMatch = line.match(/^\s*-\s*(.+)$/);
    if (listMatch && activeListKey) {
      const list = (attributes[activeListKey] as string[] | undefined) ?? [];
      list.push(parseScalar(listMatch[1] ?? ''));
      attributes[activeListKey] = list;
      continue;
    }

    const nestedMatch = line.match(/^\s{2,}([^:]+):\s*(.+)$/);
    if (nestedMatch && activeMapKey) {
      const map = (attributes[activeMapKey] as Record<string, string> | undefined) ?? {};
      map[nestedMatch[1]!.trim()] = parseScalar(nestedMatch[2] ?? '');
      attributes[activeMapKey] = map;
      continue;
    }

    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      activeMapKey = undefined;
      activeListKey = undefined;
      continue;
    }

    const key = match[1]!.trim();
    const rawValue = match[2] ?? '';
    if (!rawValue.trim()) {
      if (key === 'metadata') {
        attributes[key] = {};
        activeMapKey = key;
        activeListKey = undefined;
      } else {
        attributes[key] = [];
        activeListKey = key;
        activeMapKey = undefined;
      }
      continue;
    }

    attributes[key] = parseScalar(rawValue);
    activeMapKey = undefined;
    activeListKey = undefined;
  }

  return { attributes, body };
}

function inferSummary(body: string): string | undefined {
  const paragraph = body
    .split(/\r?\n\r?\n/)
    .map(item => item.trim())
    .find(item => item && !item.startsWith('#'));
  return paragraph ? paragraph.slice(0, 240) : undefined;
}

function inferCapabilities(fromFrontmatter: Record<string, unknown>, body: string): string[] {
  const explicit = fromFrontmatter['required-capabilities'];
  if (Array.isArray(explicit)) {
    return explicit.map(item => String(item));
  }

  const allowedTools = Array.isArray(fromFrontmatter['allowed-tools'])
    ? (fromFrontmatter['allowed-tools'] as string[])
    : [];
  if (allowedTools.length > 0) {
    return allowedTools;
  }

  const content = body.toLowerCase();
  if (content.includes('review')) return ['code-review', 'documentation'];
  if (content.includes('release') || content.includes('发布')) return ['release-ops', 'terminal'];
  if (content.includes('learning')) return ['knowledge-audit', 'documentation'];
  return ['documentation'];
}

function inferConnectors(body: string): string[] {
  const content = body.toLowerCase();
  const connectors = new Set<string>();
  if (content.includes('repo') || content.includes('仓库')) connectors.add('repo');
  if (content.includes('ci')) connectors.add('ci');
  if (content.includes('browser') || content.includes('页面')) connectors.add('browser');
  return [...connectors];
}

function parseStringList(attributes: Record<string, unknown>, key: string): string[] | undefined {
  if (!Array.isArray(attributes[key])) {
    return undefined;
  }
  const values = (attributes[key] as unknown[]).map(item => String(item).trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export async function loadAgentSkillManifests(sources: SkillSourceRecord[]): Promise<SkillManifestRecord[]> {
  const orderedSources = [...sources].sort((left, right) => {
    return PRIORITY_ORDER.indexOf(left.priority) - PRIORITY_ORDER.indexOf(right.priority);
  });
  const byId = new Map<string, SkillManifestRecord>();

  for (const source of orderedSources) {
    try {
      const entries = await readdir(source.baseUrl, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const skillPath = join(source.baseUrl, entry.name, 'SKILL.md');
        try {
          const raw = await readFile(skillPath, 'utf8');
          const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
          const { attributes, body } = parseFrontmatter(normalized);
          const id = normalizeId(String(attributes.name ?? entry.name));
          const name = String(attributes.name ?? entry.name);
          const description = String(attributes.description ?? inferSummary(body) ?? `${name} skill`);
          const allowedTools = Array.isArray(attributes['allowed-tools'])
            ? (attributes['allowed-tools'] as string[]).map(item => String(item))
            : undefined;
          const preferredMinistries = parseStringList(attributes, 'recommended-ministries') as
            | WorkerDomain[]
            | undefined;
          const recommendedSpecialists = parseStringList(attributes, 'recommended-specialists') as
            | SpecialistDomain[]
            | undefined;
          const manifest: SkillManifestRecord = {
            id,
            name,
            version: String(attributes.version ?? '0.1.0'),
            description,
            publisher: String(attributes.publisher ?? attributes.author ?? 'workspace'),
            sourceId: source.id,
            requiredCapabilities: inferCapabilities(attributes, body),
            requiredConnectors: inferConnectors(body),
            allowedTools,
            sourcePolicy: { mode: source.trustClass === 'internal' ? 'internal-only' : 'controlled-first' },
            approvalPolicy:
              (attributes['approval-policy'] as SkillManifestRecord['approvalPolicy'] | undefined) ?? 'none',
            riskLevel: (attributes['risk-level'] as SkillManifestRecord['riskLevel'] | undefined) ?? 'low',
            entry: skillPath,
            summary: inferSummary(body),
            license: typeof attributes.license === 'string' ? String(attributes.license) : undefined,
            compatibility: typeof attributes.compatibility === 'string' ? String(attributes.compatibility) : undefined,
            triggers: parseStringList(attributes, 'triggers'),
            preferredMinistries,
            recommendedSpecialists,
            specialistAffinity: recommendedSpecialists,
            executionHints: parseStringList(attributes, 'execution-hints'),
            compressionHints: parseStringList(attributes, 'compression-hints'),
            metadata:
              attributes.metadata && typeof attributes.metadata === 'object'
                ? Object.fromEntries(
                    Object.entries(attributes.metadata as Record<string, unknown>).map(([key, value]) => [
                      key,
                      String(value)
                    ])
                  )
                : undefined
          };
          byId.set(manifest.id, manifest);
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}
