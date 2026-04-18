import { describe, expect, it } from 'vitest';

import {
  HubuSearchMinistry,
  LibuDocsMinistry,
  LibuRouterMinistry,
  buildResearchSourcePlan,
  createMainRouteGraph,
  listBootstrapSkills,
  resolveWorkflowRoute,
  resolveWorkflowPreset
} from '../src';
import { listBootstrapSkills as canonicalListBootstrapSkills } from '../src/bootstrap/bootstrap-skill-registry';
import { createMainRouteGraph as canonicalCreateMainRouteGraph } from '../src/graphs/main-route.graph';
import { HubuSearchMinistry as canonicalHubuSearchMinistry } from '../src/flows/ministries/hubu-search-ministry';
import { LibuDocsMinistry as canonicalLibuDocsMinistry } from '../src/flows/ministries/libu-docs-ministry';
import { LibuRouterMinistry as canonicalLibuRouterMinistry } from '../src/flows/ministries/libu-router-ministry';
import { buildResearchSourcePlan as canonicalBuildResearchSourcePlan } from '../src/workflows/research-source-planner';
import { resolveWorkflowPreset as canonicalResolveWorkflowPreset } from '../src/workflows/workflow-preset-registry';
import { resolveWorkflowRoute as canonicalResolveWorkflowRoute } from '../src/workflows/workflow-route-registry';

describe('@agent/agents-supervisor root exports', () => {
  it('keeps stable supervisor exports wired to canonical hosts', () => {
    expect(listBootstrapSkills).toBe(canonicalListBootstrapSkills);
    expect(createMainRouteGraph).toBe(canonicalCreateMainRouteGraph);
    expect(resolveWorkflowPreset).toBe(canonicalResolveWorkflowPreset);
    expect(resolveWorkflowRoute).toBe(canonicalResolveWorkflowRoute);
    expect(buildResearchSourcePlan).toBe(canonicalBuildResearchSourcePlan);
    expect(LibuRouterMinistry).toBe(canonicalLibuRouterMinistry);
    expect(HubuSearchMinistry).toBe(canonicalHubuSearchMinistry);
    expect(LibuDocsMinistry).toBe(canonicalLibuDocsMinistry);
  });
});
