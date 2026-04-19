import { buildSkillSourcesCenter } from '../../centers/runtime-skill-sources-center';
import type { RuntimeCentersContext } from '../../centers/runtime-centers.types';
import { readInstalledSkillRecords, readSkillInstallReceipts } from '../../skills/runtime-skill-install.service';
import { listSkillManifests, listSkillSources } from '../../skills/runtime-skill-sources.service';

export async function loadSkillSourcesCenterRecord(ctx: RuntimeCentersContext) {
  const [sources, manifests, installed, receipts, skillCards] = await Promise.all([
    listSkillSources(ctx.getSkillSourcesContext()),
    listSkillManifests(ctx.getSkillSourcesContext()),
    readInstalledSkillRecords(ctx.getSkillInstallContext()),
    readSkillInstallReceipts(ctx.getSkillInstallContext()),
    ctx.skillRegistry.list()
  ]);

  return buildSkillSourcesCenter({
    sources,
    manifests,
    installed,
    receipts,
    skillCards,
    tasks: ctx.orchestrator.listTasks()
  });
}
