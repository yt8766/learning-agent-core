import { lazy, useEffect, useRef, useState, type ComponentProps, type ComponentType, type RefObject } from 'react';

import { getIntelligenceOverview, getKnowledgeGovernanceProjection } from '@/api/admin-api-platform';
import type { ArchiveCenterPanel } from '@/pages/archive-center/archive-center-panel';
import type { CompanyAgentsPanel } from '@/pages/company-agents/company-agents-panel';
import type { EvalsCenterPanel } from '@/pages/evals-center/evals-center-panel';
import type { IntelligenceCenterPage } from '@/pages/intelligence-center/intelligence-center-page';
import type { IntelligenceOverviewProjection } from '@/pages/intelligence-center/intelligence-center-types';
import type { KnowledgeGovernanceProjection } from '@/pages/knowledge-governance/knowledge-governance-types';
import type { RuntimeOverviewPanel } from '@/pages/runtime-overview/runtime-overview-panel';

type RuntimeOverviewPanelProps = ComponentProps<typeof RuntimeOverviewPanel>;
type EvalsCenterPanelProps = ComponentProps<typeof EvalsCenterPanel>;
type CompanyAgentsPanelProps = ComponentProps<typeof CompanyAgentsPanel>;
type ArchiveCenterPanelProps = ComponentProps<typeof ArchiveCenterPanel>;
type IntelligenceCenterPageProps = ComponentProps<typeof IntelligenceCenterPage>;

function createLazyCenter<TProps extends object>(
  load: () => Promise<{ default: ComponentType<TProps> }>,
  ServerRenderTestFallback: ComponentType
) {
  const LazyCenter = lazy(load);
  return function LazyCenterWithServerRenderFallback(props: TProps) {
    if (import.meta.env.MODE === 'test' && typeof window === 'undefined') {
      return <ServerRenderTestFallback />;
    }
    return <LazyCenter {...props} />;
  };
}

// Intentional route-center split points for lower-frequency or chart-heavy admin centers.
export const LazyRuntimeOverviewPanel = createLazyCenter<RuntimeOverviewPanelProps>(
  () =>
    import('@/pages/runtime-overview/runtime-overview-panel').then(module => ({
      default: module.RuntimeOverviewPanel
    })),
  () => <div>runtime panel body</div>
);

export const LazyEvalsCenterPanel = createLazyCenter<EvalsCenterPanelProps>(
  () =>
    import('@/pages/evals-center/evals-center-panel').then(module => ({
      default: module.EvalsCenterPanel
    })),
  () => <div>evals panel body</div>
);

const LazyKnowledgeGovernancePanel = lazy(() =>
  import('@/pages/knowledge-governance/knowledge-governance-panel').then(module => ({
    default: module.KnowledgeGovernancePanel
  }))
);

const LazyIntelligenceCenterPage = createLazyCenter<IntelligenceCenterPageProps>(
  () =>
    import('@/pages/intelligence-center/intelligence-center-page').then(module => ({
      default: module.IntelligenceCenterPage
    })),
  () => <div>intelligence center body</div>
);

export const LazyWorkflowLabPage = createLazyCenter<Record<string, never>>(
  () =>
    import('@/pages/workflow-lab/WorkflowLabPage').then(module => ({
      default: module.WorkflowLabPage
    })),
  () => <div>workflow lab body</div>
);

export const LazyCompanyAgentsPanel = createLazyCenter<CompanyAgentsPanelProps>(
  () =>
    import('@/pages/company-agents/company-agents-panel').then(module => ({
      default: module.CompanyAgentsPanel
    })),
  () => <div>company agents panel body</div>
);

export const LazyArchiveCenterPanel = createLazyCenter<ArchiveCenterPanelProps>(
  () =>
    import('@/pages/archive-center/archive-center-panel').then(module => ({
      default: module.ArchiveCenterPanel
    })),
  () => <div>archive panel body</div>
);

export function KnowledgeGovernanceDashboardCenter() {
  const [projection, setProjection] = useState<KnowledgeGovernanceProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  async function refreshKnowledgeGovernance() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const nextProjection = await getKnowledgeGovernanceProjection();
      if (isCurrentDashboardCenterRequest(mountedRef, requestIdRef, requestId)) {
        setProjection(nextProjection);
      }
    } catch (caught) {
      if (isCurrentDashboardCenterRequest(mountedRef, requestIdRef, requestId)) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      if (isCurrentDashboardCenterRequest(mountedRef, requestIdRef, requestId)) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void refreshKnowledgeGovernance();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <LazyKnowledgeGovernancePanel
      error={error}
      projection={projection}
      loading={loading}
      onRefresh={() => {
        void refreshKnowledgeGovernance();
      }}
    />
  );
}

export function IntelligenceDashboardCenter() {
  const [overview, setOverview] = useState<IntelligenceOverviewProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  async function refreshIntelligenceOverview() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const nextOverview = await getIntelligenceOverview();
      if (isCurrentDashboardCenterRequest(mountedRef, requestIdRef, requestId)) {
        setOverview(nextOverview);
      }
    } catch (caught) {
      if (isCurrentDashboardCenterRequest(mountedRef, requestIdRef, requestId)) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      if (isCurrentDashboardCenterRequest(mountedRef, requestIdRef, requestId)) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void refreshIntelligenceOverview();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <LazyIntelligenceCenterPage
      error={error}
      loading={loading}
      overview={overview}
      onRefresh={() => {
        void refreshIntelligenceOverview();
      }}
    />
  );
}

function isCurrentDashboardCenterRequest(
  mountedRef: RefObject<boolean>,
  requestIdRef: RefObject<number>,
  requestId: number
) {
  return mountedRef.current && requestIdRef.current === requestId;
}
