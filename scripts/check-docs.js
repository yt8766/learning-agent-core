import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const DOCS_ROOT = path.resolve('docs');
const EXTRA_LINK_CHECK_FILES = [path.resolve('README.md'), path.resolve('AGENTS.md')];
const REQUIRED_TOP_LEVEL_DIRS = [
  'architecture',
  'maps',
  'conventions',
  'apps',
  'packages',
  'agents',
  'skills',
  'contracts',
  'integration',
  'qa',
  'evals',
  'context',
  'workflows',
  'archive',
  'superpowers',
  'research',
  'design-references'
];
const REQUIRED_INDEX_DIRS = [
  'docs/architecture',
  'docs/maps',
  'docs/conventions',
  'docs/apps',
  'docs/apps/backend',
  'docs/apps/backend/agent-server',
  'docs/apps/backend/worker',
  'docs/apps/frontend',
  'docs/apps/frontend/agent-admin',
  'docs/apps/frontend/agent-chat',
  'docs/apps/frontend/knowledge',
  'docs/apps/frontend/llm-gateway',
  'docs/packages',
  'docs/packages/adapters',
  'docs/packages/config',
  'docs/packages/core',
  'docs/packages/evals',
  'docs/packages/knowledge',
  'docs/packages/memory',
  'docs/packages/platform-runtime',
  'docs/packages/report-kit',
  'docs/packages/runtime',
  'docs/packages/skill',
  'docs/packages/templates',
  'docs/packages/tools',
  'docs/agents',
  'docs/agents/coder',
  'docs/agents/company-live',
  'docs/agents/data-report',
  'docs/agents/intel-engine',
  'docs/agents/reviewer',
  'docs/agents/supervisor',
  'docs/skills',
  'docs/contracts',
  'docs/contracts/api',
  'docs/integration',
  'docs/qa',
  'docs/evals',
  'docs/context',
  'docs/workflows',
  'docs/archive',
  'docs/archive/backend-service-split',
  'docs/archive/model',
  'docs/archive/shared',
  'docs/superpowers',
  'docs/research',
  'docs/design-references'
];
const ALLOWED_STATUSES = new Set(['current', 'completed', 'snapshot', 'history', 'archive', 'proposed', 'draft']);
const ALLOWED_TYPES = new Set([
  'index',
  'architecture',
  'overview',
  'convention',
  'guide',
  'integration',
  'reference',
  'evaluation',
  'baseline',
  'plan',
  'spec',
  'history',
  'archive',
  'template',
  'note'
]);

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

function readTopLines(content, count = 12) {
  return content.split('\n').slice(0, count);
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function stripLineSuffix(targetPath) {
  return targetPath.replace(/:(\d+)(?::\d+)?$/, '');
}

function stripWrappingAngleBrackets(targetPath) {
  if (targetPath.startsWith('<') && targetPath.endsWith('>')) {
    return targetPath.slice(1, -1);
  }
  return targetPath;
}

function extractMarkdownLinks(content) {
  const links = [];
  const pattern = /\[[^\]]+\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g;

  for (const match of content.matchAll(pattern)) {
    const rawTarget = match[1].trim();
    const target = rawTarget.includes(' "') ? rawTarget.slice(0, rawTarget.indexOf(' "')) : rawTarget;
    links.push(stripWrappingAngleBrackets(target));
  }

  return links;
}

function shouldCheckLocalLink(target) {
  if (!target || target.startsWith('#')) return false;
  if (/^(https?:|mailto:|data:)/i.test(target)) return false;
  return true;
}

function resolveLocalLink(sourceFile, target) {
  const [withoutHash] = target.split('#');
  const cleaned = stripLineSuffix(withoutHash);

  if (!cleaned) return null;

  if (path.isAbsolute(cleaned)) {
    if (cleaned.startsWith(WORKSPACE_ROOT)) {
      return cleaned;
    }

    return path.resolve(WORKSPACE_ROOT, `.${cleaned}`);
  }

  return path.resolve(path.dirname(sourceFile), cleaned);
}

const errors = [];
const files = walk(DOCS_ROOT);
const linkCheckedFiles = [...files, ...EXTRA_LINK_CHECK_FILES].filter(
  (file, index, all) => all.indexOf(file) === index
);

for (const dirName of REQUIRED_TOP_LEVEL_DIRS) {
  const readmePath = path.join(DOCS_ROOT, dirName, 'README.md');
  if (!fs.existsSync(readmePath)) {
    errors.push(`missing required index: ${path.relative(process.cwd(), readmePath)}`);
  }
}

for (const dirPath of REQUIRED_INDEX_DIRS) {
  const readmePath = path.resolve(dirPath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    errors.push(`missing directory README: ${path.relative(process.cwd(), readmePath)}`);
  }
}

const topLevelAllowSet = new Set(REQUIRED_TOP_LEVEL_DIRS);
for (const entry of fs.readdirSync(DOCS_ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
  if (!topLevelAllowSet.has(entry.name)) {
    errors.push(`unregistered top-level docs directory: docs/${entry.name} (add to REQUIRED_TOP_LEVEL_DIRS or remove)`);
  }
}

for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const topLines = readTopLines(content);

  const statusLine = topLines.find(line => line.startsWith('状态：'));
  const typeLine = topLines.find(line => line.startsWith('文档类型：'));
  const scopeLine = topLines.find(line => line.startsWith('适用范围：'));
  const checkedLine = topLines.find(line => line.startsWith('最后核对：'));

  if (!statusLine) errors.push(`${rel}: missing 状态`);
  if (!typeLine) errors.push(`${rel}: missing 文档类型`);
  if (!scopeLine) errors.push(`${rel}: missing 适用范围`);
  if (!checkedLine) errors.push(`${rel}: missing 最后核对`);

  if (statusLine) {
    const status = statusLine.replace('状态：', '').trim();
    if (!ALLOWED_STATUSES.has(status)) {
      errors.push(`${rel}: unsupported 状态 "${status}"`);
    }
  }

  if (typeLine) {
    const type = typeLine.replace('文档类型：', '').trim();
    if (!ALLOWED_TYPES.has(type)) {
      errors.push(`${rel}: unsupported 文档类型 "${type}"`);
    }
  }

  if (content.includes('docs/agent-core/')) {
    errors.push(`${rel}: still references legacy docs/agent-core path`);
  }

  if (typeLine?.includes('plan') && statusLine?.includes('current') && !rel.startsWith('docs/superpowers/')) {
    errors.push(`${rel}: plan documents should not stay in 状态：current`);
  }

  if (typeLine?.includes('baseline') && statusLine?.includes('current')) {
    errors.push(`${rel}: baseline documents should not stay in 状态：current`);
  }

  if (typeLine?.includes('index')) {
    const hasCurrentDocs =
      content.includes('当前文档：') || content.includes('当前优先阅读：') || content.includes('本目录主文档：');
    if (!hasCurrentDocs) {
      errors.push(`${rel}: index documents should declare 当前文档、当前优先阅读 or 本目录主文档`);
    }
  }

  if (typeLine?.includes('integration') || typeLine?.includes('overview')) {
    const hasTopicAnchor = content.includes('本主题主文档：');
    const hasScopeAnchor = content.includes('本文只覆盖：');
    if (!hasTopicAnchor) {
      errors.push(`${rel}: integration/overview documents should declare 本主题主文档`);
    }
    if (!hasScopeAnchor) {
      errors.push(`${rel}: integration/overview documents should declare 本文只覆盖`);
    }
  }

  if (rel === 'docs/README.md') {
    const forbiddenPriorityLinks = [
      '/docs/docs-refactor-plan.md',
      '/docs/packages/evals/testing-coverage-baseline.md',
      '/docs/archive/'
    ];
    for (const bad of forbiddenPriorityLinks) {
      const inPrioritySection = content.includes('当前高优先级入口：') && content.includes(bad);
      const beforeOnDemand = content.indexOf(bad);
      const onDemandIndex = content.indexOf('按需参考入口：');
      if (inPrioritySection && beforeOnDemand !== -1 && onDemandIndex !== -1 && beforeOnDemand < onDemandIndex) {
        errors.push(`${rel}: high priority section should not include plan/baseline/archive links`);
      }
    }
  }
}

for (const file of linkCheckedFiles) {
  if (!fs.existsSync(file)) {
    errors.push(`missing markdown file for link check: ${path.relative(WORKSPACE_ROOT, file)}`);
    continue;
  }

  const rel = normalizePath(path.relative(WORKSPACE_ROOT, file));
  const content = fs.readFileSync(file, 'utf8');
  const links = extractMarkdownLinks(content);

  for (const link of links) {
    if (!shouldCheckLocalLink(link)) continue;

    const resolved = resolveLocalLink(file, link);
    if (!resolved) continue;

    if (!resolved.startsWith(WORKSPACE_ROOT)) {
      errors.push(`${rel}: link escapes workspace root -> ${link}`);
      continue;
    }

    if (!fs.existsSync(resolved)) {
      errors.push(`${rel}: broken local link -> ${link}`);
    }
  }
}

if (errors.length > 0) {
  console.error('docs check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`docs check passed for ${files.length} docs files and ${linkCheckedFiles.length} markdown link targets.`);
