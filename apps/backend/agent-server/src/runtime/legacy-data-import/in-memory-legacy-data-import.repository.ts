import type {
  LegacyDataImportError,
  LegacyDataImportReceipt,
  LegacyDataImportRecord,
  LegacyDataImportRepository
} from './legacy-data-import.types';

export class InMemoryLegacyDataImportRepository implements LegacyDataImportRepository {
  readonly records: LegacyDataImportRecord[] = [];
  readonly receipts: LegacyDataImportReceipt[] = [];
  readonly errors: LegacyDataImportError[] = [];

  async hasReceipt(receiptKey: string): Promise<boolean> {
    return this.receipts.some(receipt => receipt.receiptKey === receiptKey);
  }

  async importLegacyRecord(record: LegacyDataImportRecord): Promise<void> {
    this.records.push(record);
  }

  async recordReceipt(receipt: LegacyDataImportReceipt): Promise<void> {
    if (!(await this.hasReceipt(receipt.receiptKey))) {
      this.receipts.push(receipt);
    }
  }

  async hasError(errorKey: string): Promise<boolean> {
    return this.errors.some(error => error.errorKey === errorKey);
  }

  async recordError(error: LegacyDataImportError): Promise<void> {
    if (!(await this.hasError(error.errorKey))) {
      this.errors.push(error);
    }
  }
}
