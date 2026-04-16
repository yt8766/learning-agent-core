import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const explicitTargets = process.argv.slice(2);
const projectTargets =
  explicitTargets.length > 0 ? explicitTargets : [...collectDemoProjects('packages'), ...collectDemoProjects('agents')];

let executedCount = 0;

for (const projectPath of projectTargets) {
  const absoluteProjectPath = path.join(rootDir, projectPath);
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
    runScript(projectPath, 'build:lib');
  }

  runScript(projectPath, 'demo');
  executedCount += 1;
}

console.log('[demo] ok:', executedCount, 'projects');

function collectDemoProjects(rootSegment) {
  const segmentRoot = path.join(rootDir, rootSegment);
  if (!fs.existsSync(segmentRoot)) {
    return [];
  }

  return fs
    .readdirSync(segmentRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `${rootSegment}/${entry.name}`)
    .filter(projectPath => fs.existsSync(path.join(rootDir, projectPath, 'demo')))
    .sort((left, right) => left.localeCompare(right));
}

function runScript(projectPath, scriptName) {
  console.log(`[demo] ${projectPath} -> ${scriptName}`);

  const result = spawnSync('pnpm', [scriptName], {
    cwd: path.join(rootDir, projectPath),
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
