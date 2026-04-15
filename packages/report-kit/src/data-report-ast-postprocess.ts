import { posix as pathPosix } from 'node:path';
import ts from 'typescript';

export interface DataReportAstPostProcessSummary {
  pending: false;
  hook: 'data-report-ast-postprocess';
  processedFiles: number;
  modifiedFiles: number;
  appliedFixes: number;
  fallbackUsed: boolean;
  errorMessage?: string;
}

export interface DataReportAstPostProcessResult {
  files: Record<string, { code: string }>;
  summary: DataReportAstPostProcessSummary;
}

const ARRAY_GUARD_METHODS = new Set(['map', 'filter', 'find', 'some', 'every', 'includes', 'join']);
const STRING_GUARD_METHODS = new Set(['trim', 'toLowerCase', 'toUpperCase']);
const NUMBER_GUARD_METHODS = new Set(['toFixed', 'toLocaleString']);

export function postProcessDataReportSandpackFiles(
  files: Record<string, { code: string }>
): DataReportAstPostProcessResult {
  const output: Record<string, { code: string }> = {};
  let modifiedFiles = 0;
  let appliedFixes = 0;

  for (const [filePath, file] of Object.entries(files)) {
    const normalizedPath = normalizeOutputFilePath(filePath);
    const processed = postProcessSingleFile(normalizedPath, file.code);
    output[normalizedPath] = { code: processed.code };
    if (processed.appliedFixes > 0) {
      modifiedFiles += 1;
      appliedFixes += processed.appliedFixes;
    }
  }

  return {
    files: output,
    summary: {
      pending: false,
      hook: 'data-report-ast-postprocess',
      processedFiles: Object.keys(files).length,
      modifiedFiles,
      appliedFixes,
      fallbackUsed: false
    }
  };
}

function postProcessSingleFile(filePath: string, rawCode: string) {
  const code = stripTransportArtifacts(rawCode);
  if (!/\.(ts|tsx)$/.test(filePath)) {
    return { code, appliedFixes: code === rawCode ? 0 : 1 };
  }

  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
  const edits: Array<{ start: number; end: number; text: string }> = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const edit = createGuardEdit(node, sourceFile);
      if (edit) {
        edits.push(edit);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const normalizedImports = normalizeAliasImports(filePath, code);

  if (edits.length === 0) {
    return { code: normalizedImports, appliedFixes: normalizedImports === rawCode ? 0 : 1 };
  }

  const fixed = normalizeAliasImports(filePath, applyEdits(code, edits));
  return {
    code: fixed,
    appliedFixes: edits.length + (fixed === rawCode ? 0 : 1)
  };
}

function stripTransportArtifacts(code: string) {
  return code
    .replace(/^```(?:tsx?|json)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^[ \t]*\/\/\s*@ts-nocheck\s*\n?/m, '')
    .trim();
}

function resolveScriptKind(filePath: string) {
  if (filePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }

  return ts.ScriptKind.TS;
}

function createGuardEdit(node: ts.CallExpression, sourceFile: ts.SourceFile) {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return null;
  }

  const callee = node.expression;
  const methodName = callee.name.text;
  const target = callee.expression;

  if (!isGuardableReceiver(target)) {
    return null;
  }

  if (ARRAY_GUARD_METHODS.has(methodName)) {
    return wrapReceiverEdit(target, sourceFile, '[]');
  }

  if (STRING_GUARD_METHODS.has(methodName)) {
    return wrapReceiverEdit(target, sourceFile, "''");
  }

  if (NUMBER_GUARD_METHODS.has(methodName)) {
    return wrapReceiverEdit(target, sourceFile, '0');
  }

  return null;
}

function isGuardableReceiver(node: ts.Node) {
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const text = node.getText();
    return !text.includes('??') && !text.includes('?.');
  }

  return false;
}

function wrapReceiverEdit(target: ts.Node, sourceFile: ts.SourceFile, fallback: string) {
  const start = target.getStart(sourceFile);
  const end = target.getEnd();
  const text = target.getText(sourceFile);
  return {
    start,
    end,
    text: `(${text} ?? ${fallback})`
  };
}

function applyEdits(code: string, edits: Array<{ start: number; end: number; text: string }>) {
  const uniqueEdits = new Map<string, { start: number; end: number; text: string }>();
  for (const edit of edits) {
    uniqueEdits.set(`${edit.start}:${edit.end}:${edit.text}`, edit);
  }

  return Array.from(uniqueEdits.values())
    .sort((left, right) => right.start - left.start)
    .reduce((current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`, code);
}

function normalizeAliasImports(filePath: string, code: string) {
  return code
    .replace(/from\s+['"]@\/(components\/[^'"]+)['"]/g, (_matched, target: string) => {
      return `from '${toRelativeImport(filePath, `src/${target}`)}'`;
    })
    .replace(/from\s+['"]@\/(services\/[^'"]+)['"]/g, (_matched, target: string) => {
      return `from '${toRelativeImport(filePath, `src/${target}`)}'`;
    })
    .replace(/from\s+['"]@\/(types\/[^'"]+)['"]/g, (_matched, target: string) => {
      return `from '${toRelativeImport(filePath, `src/${target}`)}'`;
    });
}

function toRelativeImport(fromFilePath: string, toFilePath: string) {
  const from = filePathToFsPath(fromFilePath);
  const to = filePathToFsPath(toFilePath);
  const relative = pathPosix.relative(pathPosix.dirname(from), to).replace(/\.(tsx?|jsx?)$/, '');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function filePathToFsPath(filePath: string) {
  return filePath.replace(/^\//, '');
}

function normalizeOutputFilePath(filePath: string) {
  if (/^\/src\//.test(filePath) || filePath === '/package.json' || filePath === '/tsconfig.json') {
    return filePath;
  }

  if (/^\/(pages|services|types)\//.test(filePath)) {
    return `/src${filePath}`;
  }

  return filePath;
}
