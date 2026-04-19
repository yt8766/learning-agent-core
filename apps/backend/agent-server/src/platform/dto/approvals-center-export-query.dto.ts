import { ApprovalsCenterQueryDto } from './approvals-center-query.dto';
import type { ExportFormat } from '../../common/types/export-format';

export class ApprovalsCenterExportQueryDto extends ApprovalsCenterQueryDto {
  format?: ExportFormat;
}
