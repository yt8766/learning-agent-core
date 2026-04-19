import { DaysRangeQueryDto } from '../../common/dto/days-range-query.dto';

export class PlatformConsoleQueryDto extends DaysRangeQueryDto {
  view?: 'shell' | 'full';
  status?: string;
  model?: string;
  pricingSource?: string;
  runtimeExecutionMode?: string;
  runtimeInteractionKind?: string;
  approvalsExecutionMode?: string;
  approvalsInteractionKind?: string;
}
