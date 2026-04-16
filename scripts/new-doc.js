import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();

function printUsage() {
  console.log('usage: pnpm new:doc <path> [--title "Title"] [--type reference] [--status current] [--scope "scope"]');
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    title: null,
    type: 'reference',
    status: 'current',
    scope: null
  };

  const target = args.shift();
  if (!target) {
    printUsage();
    process.exit(1);
  }

  while (args.length > 0) {
    const flag = args.shift();
    const value = args.shift();

    if (!flag?.startsWith('--') || !value) {
      printUsage();
      process.exit(1);
    }

    const key = flag.slice(2);
    if (!(key in options)) {
      console.error(`unsupported option: ${flag}`);
      process.exit(1);
    }

    options[key] = value;
  }

  return {
    target,
    ...options
  };
}

function toHeading(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  return base
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ensureMarkdownPath(target) {
  const normalized = target.replace(/\\/g, '/');
  if (!normalized.endsWith('.md')) {
    console.error('target path must end with .md');
    process.exit(1);
  }

  return path.resolve(WORKSPACE_ROOT, normalized);
}

const { target, title, type, status, scope } = parseArgs(process.argv.slice(2));
const outputPath = ensureMarkdownPath(target);

if (!outputPath.startsWith(WORKSPACE_ROOT)) {
  console.error('target path must stay inside workspace root');
  process.exit(1);
}

if (fs.existsSync(outputPath)) {
  console.error(`document already exists: ${path.relative(WORKSPACE_ROOT, outputPath)}`);
  process.exit(1);
}

const outputDir = path.dirname(outputPath);
fs.mkdirSync(outputDir, { recursive: true });

const relativePath = path.relative(WORKSPACE_ROOT, outputPath).replace(/\\/g, '/');
const docTitle = title ?? toHeading(outputPath);
const docScope = scope ?? `\`${relativePath.replace(/\/[^/]+$/, '/')}\``;
const today = new Date().toISOString().slice(0, 10);

const content = `# ${docTitle}

状态：${status}
文档类型：${type}
适用范围：${docScope}
最后核对：${today}

## 1. 这篇文档解决什么问题

- 待补充

## 2. 当前真实实现

- 待补充

## 3. 边界与约束

- 待补充

## 4. 验证与回归风险

- 待补充

## 5. 继续阅读

- 待补充
`;

fs.writeFileSync(outputPath, content, 'utf8');

console.log(`created ${relativePath}`);
