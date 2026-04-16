import { dirname, join, relative, resolve } from 'node:path';

import fs from 'fs-extra';

import {
  getScaffoldTemplate,
  listScaffoldTemplates as listTemplateRegistryScaffoldTemplates,
  resolveScaffoldTemplateDir,
  type ScaffoldTemplateDefinition
} from '@agent/templates';

export interface ScaffoldFile {
  path: string;
  content: string;
  description: string;
}

export interface ScaffoldBundle {
  hostKind: 'package' | 'agent';
  name: string;
  packageName: string;
  templateId: 'package-lib' | 'agent-basic';
  mode: 'preview' | 'write';
  targetRoot: string;
  files: ScaffoldFile[];
}

export interface ScaffoldWriteResult {
  targetRoot: string;
  totalWritten: number;
  writtenFiles: string[];
  skippedFiles: string[];
}

export interface ScaffoldTargetInspection {
  targetRoot: string;
  exists: boolean;
  isEmpty: boolean;
  existingEntryCount: number;
  conflictingFiles: string[];
  canWriteSafely: boolean;
}

export interface BuildScaffoldInput {
  hostKind?: 'package' | 'agent';
  name: string;
  templateId?: 'package-lib' | 'agent-basic';
  mode?: 'preview' | 'write';
  targetRoot?: string;
}

const DEFAULT_TEMPLATE_BY_HOST = {
  package: 'package-lib',
  agent: 'agent-basic'
} as const;

const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export async function buildPackageScaffold(input: Omit<BuildScaffoldInput, 'hostKind'>): Promise<ScaffoldBundle> {
  return buildScaffold({
    ...input,
    hostKind: 'package',
    templateId: input.templateId ?? 'package-lib'
  });
}

export async function buildAgentScaffold(input: Omit<BuildScaffoldInput, 'hostKind'>): Promise<ScaffoldBundle> {
  return buildScaffold({
    ...input,
    hostKind: 'agent',
    templateId: input.templateId ?? 'agent-basic'
  });
}

export function listScaffoldTemplates(): ScaffoldTemplateDefinition[] {
  return listTemplateRegistryScaffoldTemplates();
}

export async function inspectScaffoldTarget(params: {
  bundle: ScaffoldBundle;
  targetRoot?: string;
}): Promise<ScaffoldTargetInspection> {
  const targetRoot = resolve(params.targetRoot ?? params.bundle.targetRoot);
  const exists = await fs.pathExists(targetRoot);
  const existingEntries = exists ? await fs.readdir(targetRoot) : [];
  const conflictingFiles = await collectConflictingFiles(targetRoot, params.bundle.files);

  return {
    targetRoot,
    exists,
    isEmpty: existingEntries.length === 0,
    existingEntryCount: existingEntries.length,
    conflictingFiles,
    canWriteSafely: existingEntries.length === 0 && conflictingFiles.length === 0
  };
}

export async function writeScaffoldBundle(params: {
  bundle: ScaffoldBundle;
  targetRoot?: string;
}): Promise<ScaffoldWriteResult> {
  const targetRoot = resolve(params.targetRoot ?? params.bundle.targetRoot);
  const bundle =
    targetRoot === resolve(params.bundle.targetRoot)
      ? params.bundle
      : await buildScaffold({
          hostKind: params.bundle.hostKind,
          name: params.bundle.name,
          templateId: params.bundle.templateId,
          mode: 'write',
          targetRoot
        });
  const writtenFiles: string[] = [];

  for (const file of bundle.files) {
    const outputPath = resolve(targetRoot, file.path);
    await fs.ensureDir(dirname(outputPath));
    await fs.writeFile(outputPath, file.content, 'utf8');
    writtenFiles.push(outputPath);
  }

  return {
    targetRoot,
    totalWritten: writtenFiles.length,
    writtenFiles,
    skippedFiles: []
  };
}

async function buildScaffold(input: BuildScaffoldInput): Promise<ScaffoldBundle> {
  const repoRoot = resolveRepoRoot();
  const hostKind = input.hostKind ?? 'package';
  const templateId = input.templateId ?? DEFAULT_TEMPLATE_BY_HOST[hostKind];
  const mode = input.mode ?? 'preview';
  const name = input.name.trim();

  validateScaffoldName(name);

  const template = getScaffoldTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown scaffold template: ${templateId}`);
  }
  if (template.hostKind !== hostKind) {
    throw new Error(`Template ${templateId} does not support host kind ${hostKind}`);
  }

  const templateDir = resolveScaffoldTemplateDir(templateId);
  if (!templateDir) {
    throw new Error(`Unable to resolve scaffold template directory for ${templateId}`);
  }

  const targetRoot = resolve(input.targetRoot ?? join(repoRoot, hostKind === 'package' ? 'packages' : 'agents', name));
  const tokens = buildTemplateTokens({
    hostKind,
    name,
    repoRoot,
    targetRoot
  });
  const files = collectTemplateFiles(templateDir)
    .map(templateFilePath => {
      const relativeTemplatePath = toPosixPath(relative(templateDir, templateFilePath));
      const outputPath = renderTemplate(relativeTemplatePath, tokens);

      return {
        path: outputPath,
        content: renderTemplate(fs.readFileSync(templateFilePath, 'utf8'), tokens),
        description: `Generated from ${templateId}: ${relativeTemplatePath}`
      } satisfies ScaffoldFile;
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    hostKind,
    name,
    packageName: tokens.__PACKAGE_NAME__,
    templateId,
    mode,
    targetRoot,
    files
  };
}

function validateScaffoldName(name: string) {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Scaffold name must be kebab-case: ${name}`);
  }
}

function resolveRepoRoot(): string {
  let currentDir = resolve(process.cwd());

  while (true) {
    if (fs.existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return resolve(process.cwd());
    }
    currentDir = parentDir;
  }
}

function collectTemplateFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTemplateFiles(rootDir, nextPath));
      continue;
    }

    files.push(nextPath);
  }

  return files;
}

function buildTemplateTokens(params: {
  hostKind: 'package' | 'agent';
  name: string;
  repoRoot: string;
  targetRoot: string;
}) {
  const pascalName = toPascalCase(params.name);
  const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
  const title = params.name
    .split('-')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
  const packageName = params.hostKind === 'package' ? `@agent/${params.name}` : `@agent/agents-${params.name}`;
  const zodPackageDir = resolveInstalledPackageDir('zod', params.repoRoot);
  const nodeTypesRoot = join(params.repoRoot, 'node_modules', '@types');

  return {
    __NAME__: params.name,
    __CAMEL_NAME__: camelName,
    __PASCAL_NAME__: pascalName,
    __TITLE__: title,
    __PACKAGE_NAME__: packageName,
    __REPO_ROOT_RELATIVE__: toRelativePath(params.targetRoot, params.repoRoot),
    __TARGET_ROOT_FROM_REPO__: toRelativePath(params.repoRoot, params.targetRoot),
    __ZOD_PACKAGE_RELATIVE__: toRelativePath(params.targetRoot, zodPackageDir),
    __NODE_TYPES_ROOT_RELATIVE__: toRelativePath(params.targetRoot, nodeTypesRoot)
  };
}

function renderTemplate(template: string, tokens: Record<string, string>) {
  let output = template;

  for (const [token, value] of Object.entries(tokens)) {
    output = output.split(token).join(value);
  }

  return output;
}

async function collectConflictingFiles(targetRoot: string, files: ScaffoldFile[]) {
  const conflicts: string[] = [];

  for (const file of files) {
    const outputPath = resolve(targetRoot, file.path);
    if (await fs.pathExists(outputPath)) {
      conflicts.push(file.path);
    }
  }

  return conflicts.sort((left, right) => left.localeCompare(right));
}

function toRelativePath(from: string, to: string) {
  const nextPath = toPosixPath(relative(from, to));
  return nextPath.length > 0 ? nextPath : '.';
}

function toPosixPath(value: string) {
  return value.split('\\').join('/');
}

function toPascalCase(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function resolveInstalledPackageDir(packageName: string, repoRoot: string) {
  const directCandidates = [
    join(repoRoot, 'node_modules', packageName),
    join(repoRoot, 'packages', 'tools', 'node_modules', packageName),
    join(repoRoot, 'packages', 'templates', 'node_modules', packageName)
  ];

  const directMatch = directCandidates.find(candidate => fs.existsSync(candidate));
  if (directMatch) {
    return directMatch;
  }

  const workspaceMatch = resolveWorkspacePackageDir(packageName, repoRoot);
  if (workspaceMatch) {
    return workspaceMatch;
  }

  const pnpmStoreRoot = join(repoRoot, 'node_modules', '.pnpm');
  const encodedPackageName = packageName.replace('/', '+');

  if (fs.existsSync(pnpmStoreRoot)) {
    const entries = fs.readdirSync(pnpmStoreRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(`${encodedPackageName}@`)) {
        continue;
      }

      const candidate = join(pnpmStoreRoot, entry.name, 'node_modules', packageName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error(`Unable to resolve installed package directory for ${packageName}`);
}

function resolveWorkspacePackageDir(packageName: string, repoRoot: string) {
  const workspaceRoots = [join(repoRoot, 'packages'), join(repoRoot, 'agents')];

  for (const workspaceRoot of workspaceRoots) {
    if (!fs.existsSync(workspaceRoot)) {
      continue;
    }

    const entries = fs
      .readdirSync(workspaceRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((left, right) => left.localeCompare(right));

    for (const entryName of entries) {
      const candidate = join(workspaceRoot, entryName, 'node_modules', packageName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}
