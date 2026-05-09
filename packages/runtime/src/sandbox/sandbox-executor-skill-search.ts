import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import type { ToolExecutionRequest } from '../contracts/governance';

import { collectFiles, scoreMatch } from './sandbox-executor-utils';

export async function executeFindSkills(request: ToolExecutionRequest) {
  const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
  const limit = typeof request.input.limit === 'number' ? request.input.limit : 8;
  const workspaceRoot = process.cwd();
  const localAgentSkillsRoot = resolve(workspaceRoot, '.agents', 'skills');
  const profileSkillRoots = ['platform', 'company', 'personal'].map(profile =>
    resolve(workspaceRoot, 'profile-storage', profile, 'skills')
  );
  const installedMetadataFiles = (
    await Promise.all(
      profileSkillRoots.map(root => collectFiles(resolve(root, 'installed'), filePath => filePath.endsWith('.json')))
    )
  ).flat();
  const localSkillFiles = await collectFiles(localAgentSkillsRoot, filePath => filePath.endsWith('SKILL.md'));
  const remoteIndexFiles = (
    await Promise.all(
      profileSkillRoots.map(root =>
        collectFiles(resolve(root, 'remote-sources'), filePath => filePath.endsWith('index.json'))
      )
    )
  ).flat();

  const installed = [];
  for (const filePath of installedMetadataFiles) {
    try {
      const raw = await readFile(filePath, 'utf8');
      const payload = JSON.parse(raw) as {
        manifest?: {
          id?: string;
          name?: string;
          description?: string;
          summary?: string;
          version?: string;
          sourceId?: string;
        };
      };
      const manifest = payload.manifest;
      if (!manifest?.id) {
        continue;
      }
      installed.push({
        id: manifest.id,
        displayName: manifest.name ?? manifest.id,
        kind: 'installed',
        version: manifest.version,
        sourceId: manifest.sourceId,
        path: relative(workspaceRoot, filePath),
        score: scoreMatch(
          goal,
          [manifest.id, manifest.name, manifest.description, manifest.summary].filter(Boolean).join(' ')
        )
      });
    } catch {
      continue;
    }
  }

  const local = [];
  for (const filePath of localSkillFiles) {
    try {
      const raw = await readFile(filePath, 'utf8');
      const firstHeading = raw
        .split('\n')
        .find(line => line.trim().startsWith('#'))
        ?.replace(/^#+\s*/, '')
        .trim();
      local.push({
        id: relative(localAgentSkillsRoot, dirname(filePath)),
        displayName: firstHeading || relative(workspaceRoot, dirname(filePath)),
        kind: 'local-manifest',
        path: relative(workspaceRoot, filePath),
        score: scoreMatch(goal, `${firstHeading ?? ''} ${raw.slice(0, 400)}`)
      });
    } catch {
      continue;
    }
  }

  const remote = [];
  for (const filePath of remoteIndexFiles) {
    try {
      const raw = await readFile(filePath, 'utf8');
      const payload = JSON.parse(raw) as {
        manifests?: Array<{
          id?: string;
          name?: string;
          description?: string;
          summary?: string;
          version?: string;
          sourceId?: string;
          artifactUrl?: string;
        }>;
      };
      for (const manifest of payload.manifests ?? []) {
        if (!manifest.id) {
          continue;
        }
        remote.push({
          id: manifest.id,
          displayName: manifest.name ?? manifest.id,
          kind: 'remote-manifest',
          version: manifest.version,
          sourceId: manifest.sourceId,
          artifactUrl: manifest.artifactUrl,
          path: relative(workspaceRoot, filePath),
          score: scoreMatch(
            goal,
            [manifest.id, manifest.name, manifest.description, manifest.summary].filter(Boolean).join(' ')
          )
        });
      }
    } catch {
      continue;
    }
  }

  const suggestions = [...installed, ...local, ...remote]
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))
    .slice(0, limit);

  return {
    outputSummary: suggestions.length
      ? `Found ${suggestions.length} local skill matches for "${goal}"`
      : `No local skill matches found for "${goal}"`,
    rawOutput: {
      goal,
      suggestions,
      scanned: {
        installedMetadataFiles: installedMetadataFiles.length,
        localSkillFiles: localSkillFiles.length,
        remoteIndexFiles: remoteIndexFiles.length
      }
    }
  };
}
