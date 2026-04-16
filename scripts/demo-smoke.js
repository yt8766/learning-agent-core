import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceSegments = ['packages', 'agents', 'apps'];
let workspacePackageIndex;

export function resolveLocalPath(baseDir, relativeModulePath) {
  return resolve(baseDir, relativeModulePath);
}

export function loadLocalModule(baseDir, relativeModulePath) {
  const absoluteModulePath = resolveLocalPath(baseDir, relativeModulePath);

  if (!existsSync(absoluteModulePath)) {
    const relativeArtifactPath = relative(process.cwd(), absoluteModulePath);
    throw new Error(
      `Missing demo artifact "${relativeArtifactPath}". Run pnpm build:lib for this package before pnpm demo.`
    );
  }

  return withWorkspacePackageFallback(() => require(absoluteModulePath));
}

export function summarizeModuleExports(packageName, publicApi) {
  const exportKeys = Object.keys(publicApi).sort();

  return {
    packageName,
    exportCount: exportKeys.length,
    sampleExports: exportKeys.slice(0, 5)
  };
}

export function printDemoResult(result) {
  console.log(JSON.stringify(result, null, 2));
  return result;
}

export function isExecutedDirectly(scriptFileName) {
  return typeof process.argv[1] === 'string' && basename(process.argv[1]) === scriptFileName;
}

function withWorkspacePackageFallback(loader) {
  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function resolveWorkspaceRequest(request, parent, isMain, options) {
    if (typeof request === 'string' && request.startsWith('@agent/')) {
      const fallbackPath = resolveWorkspacePackageEntry(request);
      if (fallbackPath) {
        return fallbackPath;
      }
    }

    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  try {
    return loader();
  } finally {
    Module._resolveFilename = originalResolveFilename;
  }
}

function resolveWorkspacePackageEntry(packageName) {
  const packageRecord = getWorkspacePackageIndex().get(packageName);
  if (!packageRecord) {
    return null;
  }

  const candidates = [
    packageRecord.main ? resolve(packageRecord.rootDir, packageRecord.main) : null,
    resolve(packageRecord.rootDir, 'build/cjs/index.js'),
    resolve(packageRecord.rootDir, 'src/index.ts')
  ].filter(candidate => typeof candidate === 'string');

  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

function getWorkspacePackageIndex() {
  if (!workspacePackageIndex) {
    workspacePackageIndex = buildWorkspacePackageIndex();
  }

  return workspacePackageIndex;
}

function buildWorkspacePackageIndex() {
  const index = new Map();

  for (const segment of workspaceSegments) {
    const segmentRoot = resolve(workspaceRoot, segment);
    if (!existsSync(segmentRoot)) {
      continue;
    }

    for (const entry of require('node:fs').readdirSync(segmentRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageJsonPath = resolve(segmentRoot, entry.name, 'package.json');
      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = require(packageJsonPath);
      if (typeof packageJson.name !== 'string') {
        continue;
      }

      index.set(packageJson.name, {
        rootDir: resolve(segmentRoot, entry.name),
        main: typeof packageJson.main === 'string' ? packageJson.main : null
      });
    }
  }

  return index;
}
