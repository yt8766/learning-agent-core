export type LegacyDataImportDomain = 'runtime' | 'memory' | 'rules' | 'knowledge' | 'skills';

export interface LegacyDataImportRecord {
  domain: LegacyDataImportDomain;
  sourceFile: string;
  sourceFormat: 'json' | 'jsonl';
  itemIndex: number;
  lineNumber?: number;
  receiptKey: string;
  payload: unknown;
}

export interface LegacyDataImportReceipt {
  receiptKey: string;
  domain: LegacyDataImportDomain;
  sourceFile: string;
  sourceFormat: 'json' | 'jsonl';
  itemIndex: number;
  lineNumber?: number;
  importedAt: string;
}

export interface LegacyDataImportError {
  errorKey: string;
  domain: LegacyDataImportDomain;
  sourceFile: string;
  sourceFormat: 'json' | 'jsonl';
  errorCode: 'parse_error' | 'read_error' | 'write_error';
  message: string;
  lineNumber?: number;
  recordedAt: string;
}

export interface LegacyDataImportRepository {
  hasReceipt(receiptKey: string): Promise<boolean>;
  importLegacyRecord(record: LegacyDataImportRecord): Promise<void>;
  recordReceipt(receipt: LegacyDataImportReceipt): Promise<void>;
  hasError(errorKey: string): Promise<boolean>;
  recordError(error: LegacyDataImportError): Promise<void>;
}

export interface LegacyDataImportRunResult {
  imported: number;
  skipped: number;
  errors: number;
  scannedFiles: number;
}
