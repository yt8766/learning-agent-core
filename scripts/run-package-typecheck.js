import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const workspaceArg = process.argv[2];

if (!workspaceArg) {
  console.error('[typecheck:package] missing workspace path argument');
  process.exit(1);
}

const workspaceRoot = path.resolve(repoRoot, workspaceArg);
const tsconfigPath = resolveBaseTsconfig(workspaceRoot);

if (!tsconfigPath) {
  console.error(`[typecheck:package] no tsconfig found for ${workspaceArg}`);
  process.exit(1);
}

const sourceRoot = path.join(workspaceRoot, 'src');

if (!fs.existsSync(sourceRoot)) {
  console.log(`[typecheck:package] no src directory for ${workspaceArg}`);
  process.exit(0);
}

const turboDir = path.join(workspaceRoot, '.turbo');
fs.mkdirSync(turboDir, { recursive: true });

const tempDir = fs.mkdtempSync(path.join(turboDir, 'package-typecheck-'));
const tempConfigPath = path.join(tempDir, 'tsconfig.json');
const relativeExtends = path.relative(tempDir, tsconfigPath).replace(/\\/g, '/');
const includePatterns = resolveTypecheckIncludes(tsconfigPath, workspaceRoot, tempDir, sourceRoot);

const tempConfig = {
  extends: relativeExtends,
  include: includePatterns,
  compilerOptions: {
    noEmit: true
  }
};

fs.writeFileSync(tempConfigPath, `${JSON.stringify(tempConfig, null, 2)}\n`, 'utf8');

const result = spawnSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', tempConfigPath], {
  cwd: repoRoot,
  stdio: 'inherit'
});

cleanupTempDir(tempDir);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);

function resolveBaseTsconfig(workspaceRoot) {
  const preferredConfigs = ['tsconfig.app.json', 'tsconfig.json'];

  for (const filename of preferredConfigs) {
    const configPath = path.join(workspaceRoot, filename);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

function resolveTypecheckIncludes(tsconfigPath, workspaceRoot, tempDir, sourceRoot) {
  const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  }

  const includes = Array.isArray(config?.include) ? config.include : [];
  const filteredIncludes = includes.filter(pattern => !isNonTypeLayerPattern(pattern));

  if (filteredIncludes.length > 0) {
    return filteredIncludes.map(pattern =>
      path.relative(tempDir, path.resolve(workspaceRoot, pattern)).replace(/\\/g, '/')
    );
  }

  return [path.relative(tempDir, sourceRoot).replace(/\\/g, '/').replace(/^\.\//, '') + '/**/*'];
}

function isNonTypeLayerPattern(pattern) {
  return /(^|\/)(demo|test)(\/|$)/.test(pattern);
}

function cleanupTempDir(tempDir) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
