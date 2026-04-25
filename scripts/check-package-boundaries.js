import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFilePattern = /\.(?:[cm]?[jt]sx?)$/;
const ignoredDirs = new Set(['node_modules', 'build', 'dist', '.turbo', '.git']);

const appRoots = [
  'apps/backend/agent-server/src',
  'apps/backend/agent-server/test',
  'apps/frontend/agent-admin/src',
  'apps/frontend/agent-admin/test',
  'apps/frontend/agent-chat/src',
  'apps/frontend/agent-chat/test',
  'apps/worker/src',
  'apps/worker/test'
];
const publicEntryRoots = [
  'packages/core/test',
  'packages/core/src',
  'packages/config/test',
  'packages/config/src',
  'packages/runtime/test',
  'packages/runtime/src',
  'packages/platform-runtime/test',
  'packages/platform-runtime/src',
  'packages/adapters/test',
  'packages/adapters/src',
  'packages/evals/test',
  'packages/evals/src',
  'packages/report-kit/test',
  'packages/report-kit/src',
  'packages/templates/test',
  'packages/templates/src',
  'agents/supervisor/test',
  'agents/supervisor/src',
  'agents/data-report/test',
  'agents/data-report/src',
  'agents/coder/test',
  'agents/coder/src',
  'agents/reviewer/test',
  'agents/reviewer/src',
  'packages/memory/test',
  'packages/memory/src',
  'packages/tools/src',
  'packages/tools/test',
  'packages/skill-runtime/src',
  'packages/skill-runtime/test',
  'apps/backend/agent-server/src',
  'apps/backend/agent-server/test',
  'apps/worker/src',
  'apps/worker/test'
];

const forbiddenSubpathPrefixes = [
  '@agent/config/',
  '@agent/memory/',
  '@agent/runtime/',
  '@agent/platform-runtime/',
  '@agent/adapters/',
  '@agent/tools/',
  '@agent/core/',
  '@agent/evals/',
  '@agent/report-kit/',
  '@agent/templates/',
  '@agent/agents-supervisor/',
  '@agent/agents-data-report/',
  '@agent/agents-coder/',
  '@agent/agents-reviewer/',
  '@agent/agents-intel-engine/'
];
const corePackageManifestPath = 'packages/core/package.json';
const runtimePackageManifestPath = 'packages/runtime/package.json';
const supervisorPackageManifestPath = 'agents/supervisor/package.json';
const allowedCoreDependencies = new Set(['zod']);
const appPackageManifestPaths = ['apps/backend/agent-server/package.json', 'apps/worker/package.json'];
const officialAgentPackageNames = new Set([
  '@agent/agents-supervisor',
  '@agent/agents-data-report',
  '@agent/agents-coder',
  '@agent/agents-reviewer',
  '@agent/agents-intel-engine'
]);
const forbiddenAppPlatformRuntimeImports = new Set([
  'createOfficialAgentRegistry',
  'createOfficialRuntimeAgentDependencies',
  'createPlatformRuntime',
  'createRuntimeAgentProvider',
  'listBootstrapSkills',
  'listSubgraphDescriptors',
  'listWorkflowPresets',
  'listWorkflowVersions',
  'buildResearchSourcePlan',
  'initializeTaskExecutionSteps',
  'markExecutionStepBlocked',
  'markExecutionStepCompleted',
  'markExecutionStepResumed',
  'markExecutionStepStarted',
  'mergeEvidence',
  'resolveSpecialistRoute',
  'resolveWorkflowPreset',
  'resolveWorkflowRoute',
  'runDispatchStage',
  'runGoalIntakeStage',
  'runManagerPlanStage',
  'runRouteStage',
  'LibuRouterMinistry',
  'HubuSearchMinistry',
  'LibuDocsMinistry',
  'GongbuCodeMinistry',
  'BingbuOpsMinistry',
  'XingbuReviewMinistry'
]);
const specialistAgentPackageNames = new Set([
  '@agent/agents-data-report',
  '@agent/agents-coder',
  '@agent/agents-reviewer'
]);
const allowedBackendPlatformRuntimeFiles = new Set([
  'apps/backend/agent-server/src/runtime/core/runtime.host.ts',
  'apps/backend/agent-server/src/runtime/core/runtime-data-report-facade.ts',
  'apps/backend/agent-server/src/runtime/core/runtime-centers-facade.ts',
  'apps/backend/agent-server/src/runtime/core/runtime-intel-facade.ts'
]);

function fail(messages) {
  if (messages.length === 0) {
    return;
  }

  console.error('[package-boundaries] found architecture boundary violations:\n');
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (sourceFilePattern.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function extractImportSources(text) {
  const sources = [];
  const patterns = [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      sources.push(match[1]);
    }
  }

  return sources;
}

function extractNamedImportsBySource(text) {
  const matches = [];
  const pattern = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const importedNames = match[1]
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => item.split(/\s+as\s+/i)[0]?.trim())
      .filter(Boolean);
    matches.push({
      source: match[2],
      importedNames
    });
  }

  return matches;
}

function isUnderRoots(repoPath, roots) {
  return roots.some(root => repoPath === root || repoPath.startsWith(`${root}/`));
}

function isWorkspaceSourcePath(source) {
  return /(?:^|\/)(packages|agents)\/[^'"]+\/src(?:\/|$)/.test(source);
}

function isAgentPackageSubpath(source) {
  return /^@agent\/[^/'"]+\/.+/.test(source);
}

export function findBoundaryViolations(scanRoot = rootDir) {
  const files = [
    ...walk(path.join(scanRoot, 'packages')),
    ...walk(path.join(scanRoot, 'agents')),
    ...walk(path.join(scanRoot, 'apps'))
  ];
  const violations = [];
  const corePackageManifest = path.join(scanRoot, corePackageManifestPath);

  if (fs.existsSync(corePackageManifest)) {
    const manifest = JSON.parse(fs.readFileSync(corePackageManifest, 'utf8'));
    const dependencySections = [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies
    ];

    for (const dependencies of dependencySections) {
      if (!dependencies) {
        continue;
      }

      for (const dependencyName of Object.keys(dependencies)) {
        if (dependencyName.startsWith('@agent/') && !allowedCoreDependencies.has(dependencyName)) {
          violations.push(
            `${corePackageManifestPath} depends on business package "${dependencyName}"; core may only depend on zod and pure contract foundations`
          );
        }
      }
    }
  }

  const runtimePackageManifest = path.join(scanRoot, runtimePackageManifestPath);
  if (fs.existsSync(runtimePackageManifest)) {
    const manifest = JSON.parse(fs.readFileSync(runtimePackageManifest, 'utf8'));
    const dependencySections = [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies
    ];

    for (const dependencies of dependencySections) {
      if (!dependencies) {
        continue;
      }

      for (const dependencyName of Object.keys(dependencies)) {
        if (officialAgentPackageNames.has(dependencyName)) {
          violations.push(
            `${runtimePackageManifestPath} depends on official agent package "${dependencyName}"; runtime must depend on abstract agent contracts instead of concrete official agents`
          );
        }
      }
    }
  }

  const supervisorPackageManifest = path.join(scanRoot, supervisorPackageManifestPath);
  if (fs.existsSync(supervisorPackageManifest)) {
    const manifest = JSON.parse(fs.readFileSync(supervisorPackageManifest, 'utf8'));
    const dependencySections = [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies
    ];

    for (const dependencies of dependencySections) {
      if (!dependencies) {
        continue;
      }

      for (const dependencyName of Object.keys(dependencies)) {
        if (specialistAgentPackageNames.has(dependencyName)) {
          violations.push(
            `${supervisorPackageManifestPath} depends on specialist official agent package "${dependencyName}"; supervisor must dispatch through contracts instead of depending on sibling specialist agents directly`
          );
        }
      }
    }
  }

  for (const appPackageManifestPath of appPackageManifestPaths) {
    const appPackageManifest = path.join(scanRoot, appPackageManifestPath);
    if (!fs.existsSync(appPackageManifest)) {
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(appPackageManifest, 'utf8'));
    const dependencySections = [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies
    ];

    for (const dependencies of dependencySections) {
      if (!dependencies) {
        continue;
      }

      for (const dependencyName of Object.keys(dependencies)) {
        if (officialAgentPackageNames.has(dependencyName)) {
          violations.push(
            `${appPackageManifestPath} depends on official agent package "${dependencyName}"; app packages should depend on @agent/platform-runtime for official assembly`
          );
        }
      }
    }
  }

  for (const filePath of files) {
    const repoPath = path.relative(scanRoot, filePath).replace(/\\/g, '/');
    if (repoPath.endsWith('package-boundaries-script.test.ts')) {
      continue;
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const sources = extractImportSources(text);
    const namedImports = extractNamedImportsBySource(text);

    for (const source of sources) {
      const isAppFile = isUnderRoots(repoPath, appRoots);

      if (isAppFile) {
        if (isWorkspaceSourcePath(source)) {
          violations.push(`${repoPath} imports workspace source path "${source}" from app code`);
        }

        if (
          source === '@agent/platform-runtime' &&
          repoPath.startsWith('apps/backend/agent-server/src/') &&
          !allowedBackendPlatformRuntimeFiles.has(repoPath)
        ) {
          violations.push(
            `${repoPath} imports "@agent/platform-runtime" directly from backend app code; backend should route official platform-runtime access through runtime/core facades`
          );
        }

        if (officialAgentPackageNames.has(source)) {
          violations.push(
            `${repoPath} imports official agent package "${source}" from app code; use @agent/platform-runtime instead`
          );
        }

        if (source === '@agent/platform-runtime') {
          const disallowedImports =
            namedImports
              .filter(entry => entry.source === source)
              .flatMap(entry => entry.importedNames)
              .filter(name => forbiddenAppPlatformRuntimeImports.has(name)) ?? [];

          if (disallowedImports.length > 0) {
            violations.push(
              `${repoPath} imports platform-runtime assembly helper(s) "${disallowedImports.join(
                ', '
              )}" from app code; apps should consume the platform facade instead of inlining official runtime assembly`
            );
          }
        }

        if (isAgentPackageSubpath(source)) {
          violations.push(`${repoPath} imports package subpath "${source}" from app code`);
        }
      }

      if (
        isUnderRoots(repoPath, ['packages/runtime/src', 'packages/runtime/test']) &&
        officialAgentPackageNames.has(source)
      ) {
        violations.push(
          `${repoPath} imports official agent package "${source}" from runtime code; runtime must depend on abstract agent contracts instead`
        );
      }

      if (
        isUnderRoots(repoPath, ['agents/supervisor/src', 'agents/supervisor/test']) &&
        specialistAgentPackageNames.has(source)
      ) {
        violations.push(
          `${repoPath} imports specialist official agent package "${source}" from supervisor code; supervisor must dispatch through contracts instead of depending on sibling specialist agents directly`
        );
      }

      if (
        !isAppFile &&
        isUnderRoots(repoPath, publicEntryRoots) &&
        forbiddenSubpathPrefixes.some(prefix => source.startsWith(prefix))
      ) {
        violations.push(`${repoPath} imports subpath entry "${source}" where the package root entry should be used`);
      }
    }
  }

  return violations;
}

function main() {
  const violations = findBoundaryViolations();

  if (violations.length === 0) {
    console.log('[package-boundaries] package boundaries OK');
    return;
  }

  fail(violations);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
