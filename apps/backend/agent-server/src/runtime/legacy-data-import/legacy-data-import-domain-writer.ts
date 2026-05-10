import type { LegacyDataImportRecord } from './legacy-data-import.types';

export interface LegacyDataImportDomainWriter {
  importLegacyRecord(record: LegacyDataImportRecord): Promise<void>;
}

export type LegacyDataImportDomainWriters = Partial<
  Record<LegacyDataImportRecord['domain'], LegacyDataImportDomainWriter>
>;
