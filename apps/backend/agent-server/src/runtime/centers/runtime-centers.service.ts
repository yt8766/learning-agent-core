import { RuntimeCentersGovernanceService } from './runtime-centers-governance.service';
import { RuntimeCentersQueryService } from './runtime-centers-query.service';
import {
  bindServiceMethods,
  RUNTIME_CENTER_GOVERNANCE_METHOD_NAMES,
  RUNTIME_CENTER_QUERY_METHOD_NAMES,
  RuntimeCentersContext
} from './runtime-centers.types';

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class RuntimeCentersService {
  constructor(
    getContext: () => RuntimeCentersContext,
    queryService?: RuntimeCentersQueryService,
    governanceService?: RuntimeCentersGovernanceService
  ) {
    const centersQueryService = queryService ?? new RuntimeCentersQueryService(getContext);
    const centersGovernanceService = governanceService ?? new RuntimeCentersGovernanceService(getContext);
    bindServiceMethods(this, centersQueryService, RUNTIME_CENTER_QUERY_METHOD_NAMES);
    bindServiceMethods(this, centersGovernanceService, RUNTIME_CENTER_GOVERNANCE_METHOD_NAMES);
  }
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface RuntimeCentersService extends Pick<
  RuntimeCentersQueryService,
  (typeof RUNTIME_CENTER_QUERY_METHOD_NAMES)[number]
> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface RuntimeCentersService extends Pick<
  RuntimeCentersGovernanceService,
  (typeof RUNTIME_CENTER_GOVERNANCE_METHOD_NAMES)[number]
> {}
