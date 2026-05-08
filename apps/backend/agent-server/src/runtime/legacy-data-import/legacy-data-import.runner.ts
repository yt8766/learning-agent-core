import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

import { pathExists } from 'fs-extra';

import type {
  LegacyDataImportDomain,
  LegacyDataImportError,
  LegacyDataImportRecord,
  LegacyDataImportRepository,
  LegacyDataImportRunResult
} from './legacy-data-import.types';

const LEGACY_DOMAINS: LegacyDataImportDomain[] = ['runtime', 'memory', 'rules', 'knowledge', 'skills'];

export interface LegacyDataImportRunnerOptions {
  dataRoot: string;
  repository: LegacyDataImportRepository;
  now?: () => Date;
}

interface ParsedLegacyItem {
  payload: unknown;
  itemIndex: number;
  lineNumber?: number;
}

export class LegacyDataImportRunner {
  private readonly dataRoot: string;
  private readonly repository: LegacyDataImportRepository;
  private readonly now: () => Date;

  constructor(options: LegacyDataImportRunnerOptions) {
    this.dataRoot = options.dataRoot;
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
  }

  async runOnce(): Promise<LegacyDataImportRunResult> {
    const result: LegacyDataImportRunResult = {
      imported: 0,
      skipped: 0,
      errors: 0,
      scannedFiles: 0
    };

    for (const domain of LEGACY_DOMAINS) {
      const domainRoot = join(this.dataRoot, domain);
      if (!(await pathExists(domainRoot))) {
        continue;
      }

      const files = await listLegacyDataFiles(domainRoot);
      for (const filePath of files) {
        result.scannedFiles += 1;
        await this.importFile(domain, filePath, result);
      }
    }

    return result;
  }

  private async importFile(
    domain: LegacyDataImportDomain,
    filePath: string,
    result: LegacyDataImportRunResult
  ): Promise<void> {
    const sourceFile = normalizeRelativePath(relative(this.dataRoot, filePath));
    const sourceFormat = extname(filePath) === '.jsonl' ? 'jsonl' : 'json';

    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch (error) {
      await this.recordErrorOnce({
        domain,
        sourceFile,
        sourceFormat,
        errorCode: 'read_error',
        message: error instanceof Error ? error.message : String(error),
        recordedAt: this.now().toISOString()
      });
      result.errors += 1;
      return;
    }

    const parsed = parseLegacyItems(content, sourceFormat);
    for (const error of parsed.errors) {
      await this.recordErrorOnce({
        ...error,
        domain,
        sourceFile,
        sourceFormat,
        recordedAt: this.now().toISOString()
      });
      result.errors += 1;
    }

    for (const item of parsed.items) {
      const receiptKey = createReceiptKey(domain, sourceFile, item);
      if (await this.repository.hasReceipt(receiptKey)) {
        result.skipped += 1;
        continue;
      }

      const record: LegacyDataImportRecord = {
        domain,
        sourceFile,
        sourceFormat,
        itemIndex: item.itemIndex,
        lineNumber: item.lineNumber,
        receiptKey,
        payload: item.payload
      };
      await this.repository.importLegacyRecord(record);
      await this.repository.recordReceipt({
        receiptKey,
        domain,
        sourceFile,
        sourceFormat,
        itemIndex: item.itemIndex,
        lineNumber: item.lineNumber,
        importedAt: this.now().toISOString()
      });
      result.imported += 1;
    }
  }

  private async recordErrorOnce(error: Omit<LegacyDataImportError, 'errorKey'>): Promise<void> {
    const errorKey = createErrorKey(error);
    if (await this.repository.hasError(errorKey)) {
      return;
    }
    await this.repository.recordError({ ...error, errorKey });
  }
}

function parseLegacyItems(
  content: string,
  sourceFormat: 'json' | 'jsonl'
): {
  items: ParsedLegacyItem[];
  errors: Array<Omit<LegacyDataImportError, 'domain' | 'sourceFile' | 'sourceFormat' | 'errorKey' | 'recordedAt'>>;
} {
  if (sourceFormat === 'jsonl') {
    return parseJsonLines(content);
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return {
      items: values.map((payload, index) => ({ payload, itemIndex: index })),
      errors: []
    };
  } catch (error) {
    return {
      items: [],
      errors: [
        {
          errorCode: 'parse_error',
          message: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
}

function parseJsonLines(content: string): ReturnType<typeof parseLegacyItems> {
  const items: ParsedLegacyItem[] = [];
  const errors: ReturnType<typeof parseLegacyItems>['errors'] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    try {
      items.push({
        payload: JSON.parse(line) as unknown,
        itemIndex: items.length,
        lineNumber: index + 1
      });
    } catch (error) {
      errors.push({
        errorCode: 'parse_error',
        message: error instanceof Error ? error.message : String(error),
        lineNumber: index + 1
      });
    }
  });

  return { items, errors };
}

async function listLegacyDataFiles(root: string): Promise<string[]> {
  const entries = await readdir(root);
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = join(root, entry);
      const entryStat = await stat(fullPath);
      if (entryStat.isDirectory()) {
        return listLegacyDataFiles(fullPath);
      }
      return isLegacyDataFile(fullPath) ? [fullPath] : [];
    })
  );

  return files.flat().sort();
}

function isLegacyDataFile(filePath: string): boolean {
  return filePath.endsWith('.json') || filePath.endsWith('.jsonl');
}

function normalizeRelativePath(value: string): string {
  return value.split(sep).join('/');
}

function createReceiptKey(domain: LegacyDataImportDomain, sourceFile: string, item: ParsedLegacyItem): string {
  return hashParts(['receipt', domain, sourceFile, String(item.itemIndex), stableStringify(item.payload)]);
}

function createErrorKey(error: Omit<LegacyDataImportError, 'errorKey'>): string {
  return hashParts([
    'error',
    error.domain,
    error.sourceFile,
    error.errorCode,
    String(error.lineNumber ?? 0),
    error.message
  ]);
}

function hashParts(parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}
