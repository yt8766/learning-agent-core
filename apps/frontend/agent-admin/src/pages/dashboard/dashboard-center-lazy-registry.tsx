import { lazy, useEffect, useRef, useState, type ComponentType, type RefObject } from 'react';

import { getKnowledgeGovernanceProjection } from '@/api/admin-api-platform';
import type { KnowledgeGovernanceProjection } from '@/pages/knowledge-governance/knowledge-governance-types';

type LazyCenterProps = Record<string, unknown>;

function createLazyCenter(
  load: () => Promise<{ default: ComponentType<LazyCenterProps> }>,
  ServerRenderTestFallback: ComponentType
) {
  const LazyCenter = lazy(load);
  return function LazyCenterWithServerRenderFallback(props: LazyCenterProps) {
    if (import.meta.env.MODE === 'test' && typeof window === 'undefined') {
      return <ServerRenderTestFallback />;
    }
    return <LazyCenter {...props} />;
  };
}

// Intentional route-center split points for lower-frequency or chart-heavy admin centers.
export const LazyRuntimeOverviewPanel = createLazyCenter(
  () =>
    import('@/pages/runtime-overview/runtime-overview-panel').then(module => ({
      default: module.RuntimeOverviewPanel as unknown as ComponentType<LazyCenterProps>
    })),
  () => <div>runtime panel body</div>
);

export const LazyEvalsCenterPanel = createLazyCenter(
  () =>
    import('@/pages/evals-center/evals-center-panel').then(module => ({
      default: module.EvalsCenterPanel as unknown as ComponentType<LazyCenterProps>
    })),
  () => <div>evals panel body</div>
);

const LazyKnowledgeGovernancePanel = lazy(() =>
  import('@/pages/knowledge-governance/knowledge-governance-panel').then(module => ({
    default: module.KnowledgeGovernancePanel
  }))
);

export const LazyWorkflowLabPage = createLazyCenter(
  () =>
    import('@/pages/workflow-lab/WorkflowLabPage').then(module => ({
      default: module.WorkflowLabPage as unknown as ComponentType<LazyCenterProps>
    })),
  () => <div>workflow lab body</div>
);

export const LazyCompanyAgentsPanel = createLazyCenter(
  () =>
    import('@/pages/company-agents/company-agents-panel').then(module => ({
      default: module.CompanyAgentsPanel as unknown as ComponentType<LazyCenterProps>
    })),
  () => <div>company agents panel body</div>
);

export const LazyArchiveCenterPanel = createLazyCenter(
  () =>
    import('@/pages/archive-center/archive-center-panel').then(module => ({
      default: module.ArchiveCenterPanel as unknown as ComponentType<LazyCenterProps>
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
      if (isCurrentKnowledgeGovernanceRequest(mountedRef, requestIdRef, requestId)) {
        setProjection(nextProjection);
      }
    } catch (caught) {
      if (isCurrentKnowledgeGovernanceRequest(mountedRef, requestIdRef, requestId)) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      if (isCurrentKnowledgeGovernanceRequest(mountedRef, requestIdRef, requestId)) {
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

function isCurrentKnowledgeGovernanceRequest(
  mountedRef: RefObject<boolean>,
  requestIdRef: RefObject<number>,
  requestId: number
) {
  return mountedRef.current && requestIdRef.current === requestId;
}
