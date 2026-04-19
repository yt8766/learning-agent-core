import { DaysRangeQueryDto } from '../../common/dto/days-range-query.dto';
import { ExportQueryDto } from '../../common/dto/export-query.dto';
import type { ExportFormat } from '../../common/types/export-format';

export class EvalsCenterQueryDto extends DaysRangeQueryDto implements ExportQueryDto {
  scenarioId?: string;
  outcome?: string;
  format?: ExportFormat;
}
