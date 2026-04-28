import { SkillRegistry, loadAgentSkillManifests } from '../src/index.js';
import * as contractSkillRuntimeFacade from '../src/contracts/skill-runtime-facade.js';
import { SkillRegistry as canonicalSkillRegistry } from '../src/registry/skill-registry.js';
import { loadAgentSkillManifests as canonicalLoadAgentSkillManifests } from '../src/sources/agent-skill-loader.js';

console.log(
  JSON.stringify(
    {
      rootAligned:
        SkillRegistry === canonicalSkillRegistry && loadAgentSkillManifests === canonicalLoadAgentSkillManifests,
      contractAligned:
        SkillRegistry === contractSkillRuntimeFacade.SkillRegistry &&
        loadAgentSkillManifests === contractSkillRuntimeFacade.loadAgentSkillManifests
    },
    null,
    2
  )
);
