import type { LegacyDataImportDomainWriters } from './legacy-data-import-domain-writer';
import type {
  LegacyDataImportError,
  LegacyDataImportReceipt,
  LegacyDataImportRecord,
  LegacyDataImportRepository
} from './legacy-data-import.types';

export class CompositeLegacyDataImportRepository implements LegacyDataImportRepository {
  constructor(
    private readonly stagingRepository: LegacyDataImportRepository,
    private readonly domainWriters: LegacyDataImportDomainWriters
  ) {}

  async hasReceipt(receiptKey: string): Promise<boolean> {
    return this.stagingRepository.hasReceipt(receiptKey);
  }

  async importLegacyRecord(record: LegacyDataImportRecord): Promise<void> {
    await this.stagingRepository.importLegacyRecord(record);
    await this.domainWriters[record.domain]?.importLegacyRecord(record);
  }

  async recordReceipt(receipt: LegacyDataImportReceipt): Promise<void> {
    await this.stagingRepository.recordReceipt(receipt);
  }

  async hasError(errorKey: string): Promise<boolean> {
    return this.stagingRepository.hasError(errorKey);
  }

  async recordError(error: LegacyDataImportError): Promise<void> {
    await this.stagingRepository.recordError(error);
  }
}
