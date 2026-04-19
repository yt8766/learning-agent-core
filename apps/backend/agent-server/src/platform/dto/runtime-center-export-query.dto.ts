import { RuntimeCenterQueryDto } from './runtime-center-query.dto';
import type { ExportFormat } from '../../common/types/export-format';

export class RuntimeCenterExportQueryDto extends RuntimeCenterQueryDto {
  format?: ExportFormat;
}
