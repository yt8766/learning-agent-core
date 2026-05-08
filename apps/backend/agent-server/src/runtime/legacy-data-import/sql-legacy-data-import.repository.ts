import type {
  LegacyDataImportError,
  LegacyDataImportReceipt,
  LegacyDataImportRecord,
  LegacyDataImportRepository
} from './legacy-data-import.types';

export interface LegacyDataImportSqlClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export const LEGACY_DATA_IMPORT_SCHEMA_SQL = `
create table if not exists legacy_data_import_records (
  receipt_key text primary key,
  domain text not null,
  source_file text not null,
  source_format text not null,
  item_index integer not null,
  line_number integer,
  payload jsonb not null,
  imported_at timestamptz not null default now()
);

create table if not exists legacy_data_import_receipts (
  receipt_key text primary key,
  domain text not null,
  source_file text not null,
  source_format text not null,
  item_index integer not null,
  line_number integer,
  imported_at timestamptz not null
);

create table if not exists legacy_data_import_errors (
  error_key text primary key,
  domain text not null,
  source_file text not null,
  source_format text not null,
  error_code text not null,
  message text not null,
  line_number integer,
  recorded_at timestamptz not null
);
`;

export class SqlLegacyDataImportRepository implements LegacyDataImportRepository {
  constructor(private readonly client: LegacyDataImportSqlClient) {}

  async ensureSchema(): Promise<void> {
    await this.client.query(LEGACY_DATA_IMPORT_SCHEMA_SQL);
  }

  async hasReceipt(receiptKey: string): Promise<boolean> {
    const result = await this.client.query<{ receipt_key: string }>(
      'select receipt_key from legacy_data_import_receipts where receipt_key = $1 limit 1',
      [receiptKey]
    );
    return result.rows.length > 0;
  }

  async importLegacyRecord(record: LegacyDataImportRecord): Promise<void> {
    await this.client.query(
      `insert into legacy_data_import_records
        (receipt_key, domain, source_file, source_format, item_index, line_number, payload)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       on conflict (receipt_key) do nothing`,
      [
        record.receiptKey,
        record.domain,
        record.sourceFile,
        record.sourceFormat,
        record.itemIndex,
        record.lineNumber ?? null,
        JSON.stringify(record.payload)
      ]
    );
  }

  async recordReceipt(receipt: LegacyDataImportReceipt): Promise<void> {
    await this.client.query(
      `insert into legacy_data_import_receipts
        (receipt_key, domain, source_file, source_format, item_index, line_number, imported_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (receipt_key) do nothing`,
      [
        receipt.receiptKey,
        receipt.domain,
        receipt.sourceFile,
        receipt.sourceFormat,
        receipt.itemIndex,
        receipt.lineNumber ?? null,
        receipt.importedAt
      ]
    );
  }

  async hasError(errorKey: string): Promise<boolean> {
    const result = await this.client.query<{ error_key: string }>(
      'select error_key from legacy_data_import_errors where error_key = $1 limit 1',
      [errorKey]
    );
    return result.rows.length > 0;
  }

  async recordError(error: LegacyDataImportError): Promise<void> {
    await this.client.query(
      `insert into legacy_data_import_errors
        (error_key, domain, source_file, source_format, error_code, message, line_number, recorded_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (error_key) do nothing`,
      [
        error.errorKey,
        error.domain,
        error.sourceFile,
        error.sourceFormat,
        error.errorCode,
        error.message,
        error.lineNumber ?? null,
        error.recordedAt
      ]
    );
  }
}
