import { buildCompanyAgentsCenter } from '../../centers/runtime-company-agents-center';
import type { RuntimeCentersContext } from '../../centers/runtime-centers.types';
import { getDisabledCompanyWorkerIds } from '../../helpers/runtime-connector-registry';

export function loadCompanyAgentsCenterRecord(ctx: RuntimeCentersContext) {
  return buildCompanyAgentsCenter({
    tasks: ctx.orchestrator.listTasks(),
    workers: ctx.orchestrator.listWorkers(),
    disabledWorkerIds: new Set(getDisabledCompanyWorkerIds(ctx.getConnectorRegistryContext()))
  });
}

export async function loadCompanyAgentView(ctx: RuntimeCentersContext, workerId: string) {
  return loadCompanyAgentsCenterRecord(ctx).find((item: { id: string }) => item.id === workerId);
}
