import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function collectWorkspaceProjects(workspaceRoot, rootSegment) {
  const segmentRoot = path.join(workspaceRoot, rootSegment);
  if (!fs.existsSync(segmentRoot)) {
    return [];
  }

  return fs
    .readdirSync(segmentRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      projectPath: `${rootSegment}/${entry.name}`,
      absoluteProjectPath: path.join(segmentRoot, entry.name)
    }))
    .sort((left, right) => left.projectPath.localeCompare(right.projectPath));
}

export function collectDemoProjects(workspaceRoot, rootSegment) {
  return collectWorkspaceProjects(workspaceRoot, rootSegment)
    .map(entry => entry.projectPath)
    .filter(projectPath => fs.existsSync(path.join(workspaceRoot, projectPath, 'demo')))
    .sort((left, right) => left.localeCompare(right));
}

export function validatePackageDemoCoverage(workspaceRoot) {
  const violations = [];

  for (const entry of collectWorkspaceProjects(workspaceRoot, 'packages')) {
    const packageJsonPath = path.join(entry.absoluteProjectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      violations.push(`${entry.projectPath}: missing package.json`);
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (!fs.existsSync(path.join(entry.absoluteProjectPath, 'demo'))) {
      violations.push(`${entry.projectPath}: missing demo directory`);
    }
    if (!fs.existsSync(path.join(entry.absoluteProjectPath, 'demo', 'smoke.ts'))) {
      violations.push(`${entry.projectPath}: missing demo/smoke.ts`);
    }
    if (!packageJson.scripts?.demo) {
      violations.push(`${entry.projectPath}: missing demo script`);
    }
  }

  return violations;
}

export function detectDemoLayers(workspaceRoot, projectPath) {
  const demoDir = path.join(workspaceRoot, projectPath, 'demo');

  return {
    hasSmoke: fs.existsSync(path.join(demoDir, 'smoke.ts')),
    hasContract: fs.existsSync(path.join(demoDir, 'contract.ts')),
    hasFlow: fs.existsSync(path.join(demoDir, 'flow.ts'))
  };
}

export function summarizeDemoCoverage(workspaceRoot) {
  return collectWorkspaceProjects(workspaceRoot, 'packages').map(entry => ({
    projectPath: entry.projectPath,
    ...detectDemoLayers(workspaceRoot, entry.projectPath)
  }));
}

export function runScript(workspaceRoot, projectPath, scriptName) {
  console.log(`[demo] ${projectPath} -> ${scriptName}`);

  const result = spawnSync('pnpm', [scriptName], {
    cwd: path.join(workspaceRoot, projectPath),
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function runDemoFile(workspaceRoot, projectPath, relativeFilePath, label) {
  const absoluteFilePath = path.join(workspaceRoot, projectPath, relativeFilePath);
  if (!fs.existsSync(absoluteFilePath)) {
    return false;
  }

  console.log(`[demo] ${projectPath} -> ${label}`);
  const result = spawnSync('node', ['--import', 'tsx', absoluteFilePath], {
    cwd: path.join(workspaceRoot, projectPath),
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return true;
}

export function runPackageDemos(workspaceRoot, explicitTargets = process.argv.slice(2)) {
  const normalizedTargets = explicitTargets.filter(target => target !== '--');
  const coverageViolations = validatePackageDemoCoverage(workspaceRoot);
  if (coverageViolations.length > 0) {
    for (const violation of coverageViolations) {
      console.error('[demo] required package demo missing:', violation);
    }
    return 1;
  }

  const projectTargets =
    normalizedTargets.length > 0
      ? normalizedTargets
      : [...collectDemoProjects(workspaceRoot, 'packages'), ...collectDemoProjects(workspaceRoot, 'agents')];

  let executedCount = 0;

  for (const projectPath of projectTargets) {
    const absoluteProjectPath = path.join(workspaceRoot, projectPath);
    const packageJsonPath = path.join(absoluteProjectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      console.warn('[demo] skip (missing package.json):', projectPath);
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.scripts?.demo) {
      console.warn('[demo] skip (missing demo script):', projectPath);
      continue;
    }

    if (packageJson.scripts['build:lib']) {
      runScript(workspaceRoot, projectPath, 'build:lib');
    }

    runScript(workspaceRoot, projectPath, 'demo');
    runDemoFile(workspaceRoot, projectPath, path.join('demo', 'contract.ts'), 'demo:contract');
    runDemoFile(workspaceRoot, projectPath, path.join('demo', 'flow.ts'), 'demo:flow');
    executedCount += 1;
  }

  const coverageSummary = summarizeDemoCoverage(workspaceRoot);
  console.log('[demo] ok:', executedCount, 'projects');
  console.log(
    '[demo] package layers:',
    JSON.stringify(
      {
        smoke: coverageSummary.filter(item => item.hasSmoke).length,
        contract: coverageSummary.filter(item => item.hasContract).length,
        flow: coverageSummary.filter(item => item.hasFlow).length
      },
      null,
      2
    )
  );
  return 0;
}

if (typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runPackageDemos(rootDir));
}
