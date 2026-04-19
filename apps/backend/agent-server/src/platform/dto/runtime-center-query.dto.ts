import { DaysRangeQueryDto } from '../../common/dto/days-range-query.dto';

export class RuntimeCenterQueryDto extends DaysRangeQueryDto {
  status?: string;
  model?: string;
  pricingSource?: string;
  executionMode?: string;
  interactionKind?: string;
}
