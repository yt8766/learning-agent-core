# Frontend Vercel React Refactor Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-admin`、`apps/frontend/agent-chat`、`apps/frontend/codex-chat`、`apps/frontend/knowledge`
最后核对：2026-05-05

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the frontend applications according to `vercel-react-best-practices`, reducing initial bundle weight, centralizing `knowledge` data fetching, narrowing render dependencies, and cleaning small-app/runtime hot paths.

**Architecture:** This plan follows the staged design in [Frontend Vercel React Refactor Design](/docs/superpowers/specs/2026-05-05-frontend-vercel-react-refactor-design.md). It introduces reusable lazy boundaries, React Query facades for `knowledge`, narrower projection inputs in `agent-chat`, a single refresh intent in `agent-admin`, and focused runtime modules for `codex-chat`.

**Tech Stack:** React 19, Vite, TypeScript, React Router, React Query, Ant Design, Ant Design X, Recharts, XYFlow, Vitest.

---

## Scope And Sequencing

This is a broad frontend refactor across four applications. Execute tasks in order. Each task should be its own commit unless the worker is explicitly asked to batch commits. Do not use `git worktree`; this repository forbids worktree-based implementation.

## File Structure Map

### Shared Frontend Patterns

- Create `apps/frontend/knowledge/src/app/lazy-boundary.tsx` for `knowledge` lazy route loading and retryable error display.
- Create `apps/frontend/agent-admin/src/components/lazy-center-boundary.tsx` for admin center lazy loading and retryable error display.

### `knowledge` Query Layer

- Create `apps/frontend/knowledge/src/api/knowledge-query.ts`.
- Modify existing hooks in `apps/frontend/knowledge/src/hooks/` to consume React Query while preserving current hook return shapes.
- Add tests under `apps/frontend/knowledge/test/hooks/` and `apps/frontend/knowledge/test/api/`.

### `agent-chat` Render Dependencies

- Modify `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`.
- Modify `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`.
- Modify existing helpers in `apps/frontend/agent-chat/src/pages/chat-home/*helpers*.ts`.
- Add or update tests under `apps/frontend/agent-chat/test/pages/chat-home/`.

### `agent-admin` Refresh Intent

- Modify `apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts`.
- Add helper module `apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-refresh-intent.ts`.
- Add tests under `apps/frontend/agent-admin/test/hooks/admin-dashboard/`.

### `codex-chat` Runtime Split

- Create `apps/frontend/codex-chat/src/runtime/codex-chat-message.ts`.
- Create `apps/frontend/codex-chat/src/runtime/codex-chat-events.ts`.
- Create `apps/frontend/codex-chat/src/runtime/codex-chat-title.ts`.
- Create `apps/frontend/codex-chat/src/runtime/codex-chat-stream.ts`.
- Create `apps/frontend/codex-chat/src/hooks/use-codex-chat-session.ts`.
- Create `apps/frontend/codex-chat/src/components/codex-chat-layout.tsx`.
- Shrink `apps/frontend/codex-chat/src/components/codex-chat-shell.tsx`.
- Add tests under `apps/frontend/codex-chat/test/`.

---

### Task 1: Add Lazy Boundary Components

**Files:**

- Create: `apps/frontend/knowledge/src/app/lazy-boundary.tsx`
- Create: `apps/frontend/agent-admin/src/components/lazy-center-boundary.tsx`
- Test: `apps/frontend/knowledge/test/app/lazy-boundary.test.tsx`
- Test: `apps/frontend/agent-admin/test/components/lazy-center-boundary.test.tsx`

- [ ] **Step 1: Write failing test for `knowledge` lazy boundary**

Create `apps/frontend/knowledge/test/app/lazy-boundary.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { describe, expect, it } from 'vitest';

import { KnowledgeLazyBoundary } from '@/app/lazy-boundary';

describe('KnowledgeLazyBoundary', () => {
  it('renders a loading state while the lazy module is pending', () => {
    const Pending = lazy(() => new Promise<{ default: () => JSX.Element }>(() => undefined));

    render(
      <KnowledgeLazyBoundary label="知识库页面">
        <Pending />
      </KnowledgeLazyBoundary>
    );

    expect(screen.getByText('正在加载知识库页面...')).toBeTruthy();
  });

  it('renders the lazy child after it resolves', async () => {
    const Loaded = lazy(() => Promise.resolve({ default: () => <div>Loaded route</div> }));

    render(
      <KnowledgeLazyBoundary label="知识库页面">
        <Loaded />
      </KnowledgeLazyBoundary>
    );

    await screen.findByText('Loaded route');
  });

  it('renders retry UI after a lazy module fails', async () => {
    const Broken = lazy(() => Promise.reject(new Error('chunk failed')));

    render(
      <KnowledgeLazyBoundary label="知识库页面">
        <Broken />
      </KnowledgeLazyBoundary>
    );

    await screen.findByText('知识库页面加载失败');
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run failing `knowledge` lazy boundary test**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/app/lazy-boundary.test.tsx
```

Expected: fail because `@/app/lazy-boundary` does not exist.

- [ ] **Step 3: Implement `KnowledgeLazyBoundary`**

Create `apps/frontend/knowledge/src/app/lazy-boundary.tsx`:

```tsx
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Spin } from 'antd';

interface KnowledgeLazyBoundaryProps {
  children: ReactNode;
  label: string;
}

interface KnowledgeLazyBoundaryState {
  error: Error | null;
  retryKey: number;
}

class KnowledgeLazyErrorBoundary extends Component<KnowledgeLazyBoundaryProps, KnowledgeLazyBoundaryState> {
  state: KnowledgeLazyBoundaryState = {
    error: null,
    retryKey: 0
  };

  static getDerivedStateFromError(error: Error): Partial<KnowledgeLazyBoundaryState> {
    return { error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // React still requires this lifecycle for class error boundaries.
  }

  render() {
    if (this.state.error) {
      return (
        <Alert
          action={
            <Button
              onClick={() => this.setState(current => ({ error: null, retryKey: current.retryKey + 1 }))}
              size="small"
            >
              重试
            </Button>
          }
          message={`${this.props.label}加载失败`}
          showIcon
          type="error"
        />
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

export function KnowledgeLazyBoundary({ children, label }: KnowledgeLazyBoundaryProps) {
  return (
    <KnowledgeLazyErrorBoundary label={label}>
      <Suspense fallback={<Spin tip={`正在加载${label}...`} />}>{children}</Suspense>
    </KnowledgeLazyErrorBoundary>
  );
}
```

- [ ] **Step 4: Write failing test for `agent-admin` lazy center boundary**

Create `apps/frontend/agent-admin/test/components/lazy-center-boundary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { describe, expect, it } from 'vitest';

import { LazyCenterBoundary } from '@/components/lazy-center-boundary';

describe('LazyCenterBoundary', () => {
  it('renders loading copy while a center chunk is pending', () => {
    const Pending = lazy(() => new Promise<{ default: () => JSX.Element }>(() => undefined));

    render(
      <LazyCenterBoundary label="Runtime Center">
        <Pending />
      </LazyCenterBoundary>
    );

    expect(screen.getByText('正在加载 Runtime Center...')).toBeTruthy();
  });

  it('renders error copy when a center chunk fails', async () => {
    const Broken = lazy(() => Promise.reject(new Error('chunk failed')));

    render(
      <LazyCenterBoundary label="Runtime Center">
        <Broken />
      </LazyCenterBoundary>
    );

    await screen.findByText('Runtime Center 加载失败');
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});
```

- [ ] **Step 5: Implement `LazyCenterBoundary`**

Create `apps/frontend/agent-admin/src/components/lazy-center-boundary.tsx`:

```tsx
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardLoadingState } from '@/pages/dashboard/dashboard-loading-state';

interface LazyCenterBoundaryProps {
  children: ReactNode;
  label: string;
}

interface LazyCenterBoundaryState {
  error: Error | null;
  retryKey: number;
}

class LazyCenterErrorBoundary extends Component<LazyCenterBoundaryProps, LazyCenterBoundaryState> {
  state: LazyCenterBoundaryState = {
    error: null,
    retryKey: 0
  };

  static getDerivedStateFromError(error: Error): Partial<LazyCenterBoundaryState> {
    return { error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // React still requires this lifecycle for class error boundaries.
  }

  render() {
    if (this.state.error) {
      return (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-medium">{this.props.label} 加载失败</p>
            <Button
              onClick={() => this.setState(current => ({ error: null, retryKey: current.retryKey + 1 }))}
              size="sm"
            >
              重试
            </Button>
          </CardContent>
        </Card>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

export function LazyCenterBoundary({ children, label }: LazyCenterBoundaryProps) {
  return (
    <LazyCenterErrorBoundary label={label}>
      <Suspense fallback={<DashboardLoadingState message={`正在加载 ${label}...`} />}>{children}</Suspense>
    </LazyCenterErrorBoundary>
  );
}
```

- [ ] **Step 6: Run boundary tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/app/lazy-boundary.test.tsx
pnpm --dir apps/frontend/agent-admin turbo:test:unit -- test/components/lazy-center-boundary.test.tsx
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge/src/app/lazy-boundary.tsx apps/frontend/knowledge/test/app/lazy-boundary.test.tsx apps/frontend/agent-admin/src/components/lazy-center-boundary.tsx apps/frontend/agent-admin/test/components/lazy-center-boundary.test.tsx
git commit -m "refactor(frontend): add lazy loading boundaries"
```

---

### Task 2: Split `knowledge` Routes And Flow Canvas Chunks

**Files:**

- Modify: `apps/frontend/knowledge/src/app/App.tsx`
- Modify: `apps/frontend/knowledge/src/pages/agent-flow/agent-flow-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/agent-flow/lazy-agent-flow-canvas.tsx`
- Test: `apps/frontend/knowledge/test/app-render.test.tsx`

- [ ] **Step 1: Add route render test for a lazy low-frequency page**

Update `apps/frontend/knowledge/test/app-render.test.tsx` with a test that renders `/evals` and waits for the evals page heading:

```tsx
it('renders the lazy evals route', async () => {
  window.history.pushState({}, '', '/evals');

  render(<App authClient={createAuthenticatedAuthClient()} />);

  expect(await screen.findByText('评测中心')).toBeTruthy();
});
```

Use the existing authenticated auth client helper in the file. If the helper has a different name, reuse that exact helper instead of creating a second auth mock.

- [ ] **Step 2: Run the focused route test**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/app-render.test.tsx
```

Expected: pass before implementation. This guards behavior before splitting chunks.

- [ ] **Step 3: Convert low-frequency routes to lazy imports**

Modify `apps/frontend/knowledge/src/app/App.tsx`:

```tsx
import { lazy } from 'react';
```

Replace static imports for low-frequency pages with lazy imports:

```tsx
const AccountSettingsPage = lazy(() =>
  import('../pages/account/account-settings-page').then(mod => ({ default: mod.AccountSettingsPage }))
);
const AgentFlowPage = lazy(() =>
  import('../pages/agent-flow/agent-flow-page').then(mod => ({ default: mod.AgentFlowPage }))
);
const ChatLabPage = lazy(() => import('../pages/chat-lab/chat-lab-page').then(mod => ({ default: mod.ChatLabPage })));
const DocumentDetailPage = lazy(() =>
  import('../pages/documents/document-detail-page').then(mod => ({ default: mod.DocumentDetailPage }))
);
const EvalsPage = lazy(() => import('../pages/evals/evals-page').then(mod => ({ default: mod.EvalsPage })));
const KnowledgeBaseDetailPage = lazy(() =>
  import('../pages/knowledge-bases/knowledge-base-detail-page').then(mod => ({ default: mod.KnowledgeBaseDetailPage }))
);
const ObservabilityPage = lazy(() =>
  import('../pages/observability/observability-page').then(mod => ({ default: mod.ObservabilityPage }))
);
const SettingsKeysPage = lazy(() =>
  import('../pages/settings/settings-keys-page').then(mod => ({ default: mod.SettingsKeysPage }))
);
const SettingsModelsPage = lazy(() =>
  import('../pages/settings/settings-models-page').then(mod => ({ default: mod.SettingsModelsPage }))
);
const SettingsSecurityPage = lazy(() =>
  import('../pages/settings/settings-security-page').then(mod => ({ default: mod.SettingsSecurityPage }))
);
const SettingsStoragePage = lazy(() =>
  import('../pages/settings/settings-storage-page').then(mod => ({ default: mod.SettingsStoragePage }))
);
const UsersPage = lazy(() => import('../pages/users/users-page').then(mod => ({ default: mod.UsersPage })));
```

Keep `OverviewPage`, `KnowledgeBasesPage`, `DocumentsPage`, `SettingsPage`, and exception pages static unless tests show they are also low-frequency in the current app shell.

Wrap lazy routes with `KnowledgeLazyBoundary`:

```tsx
<Route
  element={
    <KnowledgeLazyBoundary label="评测中心">
      <EvalsPage />
    </KnowledgeLazyBoundary>
  }
  path="evals"
/>
```

Apply the same pattern to each lazy page.

- [ ] **Step 4: Lazy-load `AgentFlowCanvas`**

Create `apps/frontend/knowledge/src/pages/agent-flow/lazy-agent-flow-canvas.tsx`:

```tsx
import { lazy } from 'react';

import { KnowledgeLazyBoundary } from '../../app/lazy-boundary';
import type { AgentFlowCanvasProps } from './agent-flow-canvas';

const AgentFlowCanvas = lazy(() => import('./agent-flow-canvas').then(mod => ({ default: mod.AgentFlowCanvas })));

export function LazyAgentFlowCanvas(props: AgentFlowCanvasProps) {
  return (
    <KnowledgeLazyBoundary label="Agent Flow 画布">
      <AgentFlowCanvas {...props} />
    </KnowledgeLazyBoundary>
  );
}
```

Modify `agent-flow-canvas.tsx` to export props:

```tsx
export interface AgentFlowCanvasProps {
  flow: AgentFlowRecord;
  onSelectedNodeChange: (nodeId: string | undefined) => void;
  selectedNodeId?: string;
}
```

Modify `agent-flow-page.tsx` to import `LazyAgentFlowCanvas` instead of `AgentFlowCanvas`.

- [ ] **Step 5: Run tests and build**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/app-render.test.tsx test/knowledge-agent-flow-page.test.tsx
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
```

Expected: all pass. Build output should contain more than one JS chunk for low-frequency pages.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/knowledge/src/app/App.tsx apps/frontend/knowledge/src/pages/agent-flow/agent-flow-page.tsx apps/frontend/knowledge/src/pages/agent-flow/agent-flow-canvas.tsx apps/frontend/knowledge/src/pages/agent-flow/lazy-agent-flow-canvas.tsx apps/frontend/knowledge/test/app-render.test.tsx
git commit -m "refactor(knowledge): lazy load low frequency routes"
```

---

### Task 3: Split `agent-admin` Center And Chart Chunks

**Files:**

- Modify: `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx`
- Create: `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-lazy-registry.tsx`
- Modify: `apps/frontend/agent-admin/src/pages/runtime-overview/components/runtime-analytics-section.tsx`
- Create: `apps/frontend/agent-admin/src/pages/runtime-overview/components/lazy-runtime-analytics-charts.tsx`
- Test: `apps/frontend/agent-admin/test/app/app.test.tsx`

- [ ] **Step 1: Add center navigation render test**

Update `apps/frontend/agent-admin/test/app/app.test.tsx` with a test that renders the app at `/evals` and waits for the center title:

```tsx
it('renders lazy evals center route', async () => {
  window.history.pushState({}, '', '/evals');
  setAuthenticatedAdminSession();

  render(<App />);

  expect(await screen.findByText('Evals Center')).toBeTruthy();
});
```

Use the existing auth helper in this test file. If the heading text is Chinese in the current component, assert the current visible center title instead of changing UI copy.

- [ ] **Step 2: Run the test before refactor**

Run:

```bash
pnpm --dir apps/frontend/agent-admin turbo:test:unit -- test/app/app.test.tsx
```

Expected: pass before implementation.

- [ ] **Step 3: Create center lazy registry**

Create `apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-lazy-registry.tsx`:

```tsx
import { lazy } from 'react';

export const LazyRuntimeOverviewPanel = lazy(() =>
  import('@/pages/runtime-overview/runtime-overview-panel').then(mod => ({ default: mod.RuntimeOverviewPanel }))
);
export const LazyEvalsCenterPanel = lazy(() =>
  import('@/pages/evals-center/evals-center-panel').then(mod => ({ default: mod.EvalsCenterPanel }))
);
export const LazyKnowledgeGovernancePanel = lazy(() =>
  import('@/pages/knowledge-governance/knowledge-governance-panel').then(mod => ({
    default: mod.KnowledgeGovernancePanel
  }))
);
export const LazyWorkflowLabPage = lazy(() =>
  import('@/pages/workflow-lab/WorkflowLabPage').then(mod => ({ default: mod.WorkflowLabPage }))
);
export const LazyCompanyAgentsPanel = lazy(() =>
  import('@/pages/company-agents/company-agents-panel').then(mod => ({ default: mod.CompanyAgentsPanel }))
);
export const LazyArchiveCenterPanel = lazy(() =>
  import('@/pages/archive-center/archive-center-panel').then(mod => ({ default: mod.ArchiveCenterPanel }))
);
```

- [ ] **Step 4: Use lazy panels in `renderDashboardCenter`**

Modify `dashboard-center-content.tsx`:

```tsx
import { LazyCenterBoundary } from '@/components/lazy-center-boundary';
import {
  LazyArchiveCenterPanel,
  LazyCompanyAgentsPanel,
  LazyEvalsCenterPanel,
  LazyKnowledgeGovernancePanel,
  LazyRuntimeOverviewPanel,
  LazyWorkflowLabPage
} from './dashboard-center-lazy-registry';
```

For each lazy center case, wrap the panel:

```tsx
return (
  <LazyCenterBoundary label="Runtime Center">
    <LazyRuntimeOverviewPanel {...runtimeProps} />
  </LazyCenterBoundary>
);
```

Keep lightweight centers static in this task to reduce blast radius.

- [ ] **Step 5: Lazy-load runtime analytics charts**

Create `apps/frontend/agent-admin/src/pages/runtime-overview/components/lazy-runtime-analytics-charts.tsx`:

```tsx
import { lazy } from 'react';

import { LazyCenterBoundary } from '@/components/lazy-center-boundary';
import type { RuntimeAnalyticsChartsProps } from './runtime-analytics-charts';

const RuntimeAnalyticsCharts = lazy(() =>
  import('./runtime-analytics-charts').then(mod => ({ default: mod.RuntimeAnalyticsCharts }))
);

export function LazyRuntimeAnalyticsCharts(props: RuntimeAnalyticsChartsProps) {
  return (
    <LazyCenterBoundary label="Runtime 图表">
      <RuntimeAnalyticsCharts {...props} />
    </LazyCenterBoundary>
  );
}
```

Export `RuntimeAnalyticsChartsProps` from `runtime-analytics-charts.tsx`.

Modify `runtime-analytics-section.tsx` to render `LazyRuntimeAnalyticsCharts`.

- [ ] **Step 6: Run admin tests and build**

Run:

```bash
pnpm --dir apps/frontend/agent-admin turbo:test:unit -- test/app/app.test.tsx test/components/lazy-center-boundary.test.tsx
pnpm --dir apps/frontend/agent-admin typecheck
pnpm --dir apps/frontend/agent-admin build
```

Expected: all pass. Build output should contain separate chunks for lazy centers and charts.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-lazy-registry.tsx apps/frontend/agent-admin/src/pages/runtime-overview/components/runtime-analytics-section.tsx apps/frontend/agent-admin/src/pages/runtime-overview/components/runtime-analytics-charts.tsx apps/frontend/agent-admin/src/pages/runtime-overview/components/lazy-runtime-analytics-charts.tsx apps/frontend/agent-admin/test/app/app.test.tsx
git commit -m "refactor(agent-admin): lazy load dashboard centers"
```

---

### Task 4: Add `knowledge` React Query Keys And Query Tests

**Files:**

- Create: `apps/frontend/knowledge/src/api/knowledge-query.ts`
- Test: `apps/frontend/knowledge/test/api/knowledge-query.test.ts`

- [ ] **Step 1: Write failing query key tests**

Create `apps/frontend/knowledge/test/api/knowledge-query.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { knowledgeQueryKeys } from '@/api/knowledge-query';

describe('knowledgeQueryKeys', () => {
  it('creates stable keys for document lists', () => {
    expect(knowledgeQueryKeys.documents({ knowledgeBaseId: 'kb-1' })).toEqual([
      'knowledge',
      'documents',
      { knowledgeBaseId: 'kb-1' }
    ]);
  });

  it('normalizes empty document filters', () => {
    expect(knowledgeQueryKeys.documents({})).toEqual(['knowledge', 'documents', {}]);
    expect(knowledgeQueryKeys.documents()).toEqual(['knowledge', 'documents', {}]);
  });

  it('creates stable trace detail keys', () => {
    expect(knowledgeQueryKeys.trace('trace-1')).toEqual(['knowledge', 'observability', 'trace', 'trace-1']);
  });

  it('creates stable eval comparison keys', () => {
    expect(
      knowledgeQueryKeys.evalRunComparison({
        baselineRunId: 'run-a',
        candidateRunId: 'run-b'
      })
    ).toEqual(['knowledge', 'evals', 'comparison', { baselineRunId: 'run-a', candidateRunId: 'run-b' }]);
  });
});
```

- [ ] **Step 2: Run failing query key tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/api/knowledge-query.test.ts
```

Expected: fail because `knowledge-query.ts` does not exist.

- [ ] **Step 3: Implement query keys**

Create `apps/frontend/knowledge/src/api/knowledge-query.ts`:

```ts
export const knowledgeQueryKeys = {
  root: () => ['knowledge'] as const,
  dashboardOverview: () => ['knowledge', 'dashboard', 'overview'] as const,
  knowledgeBases: () => ['knowledge', 'knowledge-bases'] as const,
  knowledgeBase: (knowledgeBaseId: string) => ['knowledge', 'knowledge-bases', knowledgeBaseId] as const,
  documents: (input: { knowledgeBaseId?: string } = {}) =>
    ['knowledge', 'documents', input.knowledgeBaseId ? { knowledgeBaseId: input.knowledgeBaseId } : {}] as const,
  document: (documentId: string) => ['knowledge', 'documents', documentId] as const,
  observabilityMetrics: () => ['knowledge', 'observability', 'metrics'] as const,
  traces: () => ['knowledge', 'observability', 'traces'] as const,
  trace: (traceId: string) => ['knowledge', 'observability', 'trace', traceId] as const,
  evalDatasets: () => ['knowledge', 'evals', 'datasets'] as const,
  evalRuns: () => ['knowledge', 'evals', 'runs'] as const,
  evalRunComparison: (input: { baselineRunId: string; candidateRunId: string }) =>
    ['knowledge', 'evals', 'comparison', input] as const,
  workspaceUsers: () => ['knowledge', 'workspace', 'users'] as const,
  settingsModelProviders: () => ['knowledge', 'settings', 'model-providers'] as const,
  settingsApiKeys: () => ['knowledge', 'settings', 'api-keys'] as const,
  settingsStorage: () => ['knowledge', 'settings', 'storage'] as const,
  settingsSecurity: () => ['knowledge', 'settings', 'security'] as const,
  chatAssistantConfig: () => ['knowledge', 'chat', 'assistant-config'] as const
};

export const KNOWLEDGE_QUERY_STALE_TIME_MS = 30_000;
```

- [ ] **Step 4: Run query key tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/api/knowledge-query.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/knowledge/src/api/knowledge-query.ts apps/frontend/knowledge/test/api/knowledge-query.test.ts
git commit -m "refactor(knowledge): add query key registry"
```

---

### Task 5: Migrate Core `knowledge` Hooks To React Query

**Files:**

- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-dashboard.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-documents.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-base-detail.ts`
- Test: existing relevant `apps/frontend/knowledge/test/*.test.tsx`

- [ ] **Step 1: Add test for documents mutation invalidation**

Update the documents hook test file that currently covers upload/delete/reprocess flows. Add:

```ts
it('invalidates documents after upload', async () => {
  const invalidateQueries = vi.fn();
  const queryClient = createKnowledgeTestQueryClient({ invalidateQueries });
  const api = createKnowledgeApiMock({
    listDocuments: vi.fn().mockResolvedValue({ items: [] }),
    uploadDocument: vi.fn().mockResolvedValue({ id: 'upload-1' })
  });

  const { result } = renderKnowledgeHook(() => useKnowledgeDocuments(), { api, queryClient });

  await act(async () => {
    await result.current.uploadDocument(new File(['body'], 'demo.md'), 'kb-1');
  });

  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: knowledgeQueryKeys.documents() });
});
```

Reuse existing test providers. If this repository has no `createKnowledgeTestQueryClient`, add a small helper in the same test file:

```ts
function createKnowledgeTestQueryClient(overrides: Partial<QueryClient> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return Object.assign(client, overrides);
}
```

- [ ] **Step 2: Run focused hook tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/knowledge-upload-flow.test.tsx test/knowledge-document-detail.test.tsx
```

Expected: at least one new test fails because hooks still use manual reload instead of invalidation.

- [ ] **Step 3: Migrate `useKnowledgeDashboard`**

Replace manual state in `use-knowledge-dashboard.ts` with `useQuery`:

```ts
const overviewQuery = useQuery({
  queryKey: knowledgeQueryKeys.dashboardOverview(),
  queryFn: () => api.getDashboardOverview(),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
});
const knowledgeBasesQuery = useQuery({
  queryKey: knowledgeQueryKeys.knowledgeBases(),
  queryFn: () => api.listKnowledgeBases(),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
});
```

Return the old facade shape:

```ts
return {
  loading: overviewQuery.isLoading || knowledgeBasesQuery.isLoading,
  error: toErrorOrNull(overviewQuery.error ?? knowledgeBasesQuery.error),
  overview: overviewQuery.data ?? null,
  knowledgeBases: knowledgeBasesQuery.data?.items ?? [],
  reload: async () => {
    await Promise.all([overviewQuery.refetch(), knowledgeBasesQuery.refetch()]);
  }
};
```

- [ ] **Step 4: Migrate `useKnowledgeDocuments`**

Use `useQuery`, `useMutation`, and `useQueryClient`:

```ts
const queryClient = useQueryClient();
const documentsQuery = useQuery({
  queryKey: knowledgeQueryKeys.documents(),
  queryFn: () => api.listDocuments(),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
});
const uploadMutation = useMutation({
  mutationFn: ({ file, knowledgeBaseId }: { file: File; knowledgeBaseId: string }) =>
    api.uploadDocument({ file, knowledgeBaseId }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() })
});
```

Keep `uploadDocument(file, knowledgeBaseId)`, `deleteDocument(documentId)`, and `reprocessDocument(documentId)` signatures unchanged.

- [ ] **Step 5: Migrate `useKnowledgeBaseDetail`**

Use two queries:

```ts
const knowledgeBasesQuery = useQuery({
  queryKey: knowledgeQueryKeys.knowledgeBases(),
  queryFn: () => api.listKnowledgeBases(),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS,
  enabled: Boolean(knowledgeBaseId)
});
const documentsQuery = useQuery({
  queryKey: knowledgeQueryKeys.documents({ knowledgeBaseId }),
  queryFn: () => api.listDocuments({ knowledgeBaseId }),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS,
  enabled: Boolean(knowledgeBaseId)
});
```

Return `error: new Error('缺少知识库 ID')` when `knowledgeBaseId` is missing.

- [ ] **Step 6: Run focused hook tests and typecheck**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/knowledge-upload-flow.test.tsx test/knowledge-document-detail.test.tsx test/app-render.test.tsx
pnpm --dir apps/frontend/knowledge typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge/src/hooks/use-knowledge-dashboard.ts apps/frontend/knowledge/src/hooks/use-knowledge-documents.ts apps/frontend/knowledge/src/hooks/use-knowledge-base-detail.ts apps/frontend/knowledge/test
git commit -m "refactor(knowledge): migrate core hooks to react query"
```

---

### Task 6: Migrate Remaining `knowledge` Query Hooks

**Files:**

- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-observability.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-evals.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-governance.ts`
- Test: `apps/frontend/knowledge/test/knowledge-governance-pages-api.test.tsx`
- Test: `apps/frontend/knowledge/test/app-render.test.tsx`

- [ ] **Step 1: Add observability detail query test**

Add a test around `useKnowledgeObservability` that selects a trace and asserts `api.getTrace` is called directly for that trace id without requiring another metrics request:

```ts
it('loads selected trace detail through a separate query', async () => {
  const api = createKnowledgeApiMock({
    getObservabilityMetrics: vi.fn().mockResolvedValue({ requests: 1 }),
    listTraces: vi.fn().mockResolvedValue({ items: [{ id: 'trace-1', createdAt: '2026-05-05T00:00:00.000Z' }] }),
    getTrace: vi.fn().mockResolvedValue({ id: 'trace-2', events: [] })
  });

  const { result } = renderKnowledgeHook(() => useKnowledgeObservability(), { api });

  await act(async () => {
    await result.current.selectTrace('trace-2');
  });

  expect(api.getTrace).toHaveBeenCalledWith('trace-2');
});
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/app-render.test.tsx test/knowledge-governance-pages-api.test.tsx
```

Expected: pass before implementation except the new detail-query assertion if it exposes the old waterfall.

- [ ] **Step 3: Migrate `useKnowledgeObservability`**

Use separate queries:

```ts
const metricsQuery = useQuery({
  queryKey: knowledgeQueryKeys.observabilityMetrics(),
  queryFn: () => api.getObservabilityMetrics(),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
});
const tracesQuery = useQuery({
  queryKey: knowledgeQueryKeys.traces(),
  queryFn: () => api.listTraces(),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
});
const traceQuery = useQuery({
  queryKey: selectedTraceId ? knowledgeQueryKeys.trace(selectedTraceId) : knowledgeQueryKeys.trace('none'),
  queryFn: () => api.getTrace(selectedTraceId as string),
  enabled: Boolean(selectedTraceId),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
});
```

Set the first trace id in an effect only when no selected id exists and traces are loaded:

```ts
useEffect(() => {
  if (!selectedTraceId && tracesQuery.data?.items[0]?.id) {
    setSelectedTraceId(tracesQuery.data.items[0].id);
  }
}, [selectedTraceId, tracesQuery.data?.items]);
```

- [ ] **Step 4: Migrate `useKnowledgeEvals`**

Use separate queries for datasets, runs, and comparison. Enable comparison only when two runs exist:

```ts
const comparisonQuery = useQuery({
  queryKey:
    baselineRun && candidateRun
      ? knowledgeQueryKeys.evalRunComparison({ baselineRunId: baselineRun.id, candidateRunId: candidateRun.id })
      : knowledgeQueryKeys.evalRunComparison({ baselineRunId: 'none', candidateRunId: 'none' }),
  queryFn: () => api.compareEvalRuns({ baselineRunId: baselineRun!.id, candidateRunId: candidateRun!.id }),
  enabled: Boolean(baselineRun && candidateRun),
  staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
});
```

- [ ] **Step 5: Migrate governance/settings hooks**

Replace `useKnowledgeProjection(load)` internals with `useQuery` while preserving exported hook return values:

```ts
function useKnowledgeProjection<T>(queryKey: readonly unknown[], load: () => Promise<T>): AsyncState<T> {
  const query = useQuery({
    queryKey,
    queryFn: load,
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });

  return {
    data: query.data ?? null,
    error: toErrorOrNull(query.error),
    loading: query.isLoading,
    reload: async () => {
      await query.refetch();
    }
  };
}
```

Each exported hook passes its specific query key from `knowledgeQueryKeys`.

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/app-render.test.tsx test/knowledge-governance-pages-api.test.tsx
pnpm --dir apps/frontend/knowledge typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge/src/hooks/use-knowledge-observability.ts apps/frontend/knowledge/src/hooks/use-knowledge-evals.ts apps/frontend/knowledge/src/hooks/use-knowledge-governance.ts apps/frontend/knowledge/test
git commit -m "refactor(knowledge): migrate secondary hooks to react query"
```

---

### Task 7: Narrow `agent-chat` Memo Dependencies

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`
- Modify: related `apps/frontend/agent-chat/src/pages/chat-home/*helpers*.ts`
- Test: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx`
- Test: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx`

- [ ] **Step 1: Add projection helper tests**

In the relevant chat-home helper test file, add:

```ts
it('builds thought items from explicit fields instead of the whole chat facade', () => {
  const result = buildThoughtItemsFromFields({
    checkpoint: createCheckpointFixture({ loading: true }),
    events: [],
    messages: []
  });

  expect(result.length).toBeGreaterThan(0);
});
```

Use existing fixture creators from the test file. If none exist, define a minimal fixture inline with only the fields read by the helper.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat turbo:test:unit -- test/pages/chat-home/chat-home-page.test.tsx test/pages/chat-home/chat-home-workbench.render.test.tsx
```

Expected: fail because `buildThoughtItemsFromFields` does not exist.

- [ ] **Step 3: Replace whole-facade helper signatures**

In `chat-home-page-helpers.ts` or the current helper host, add explicit input types:

```ts
export interface ThoughtItemsInput {
  checkpoint: ChatCheckpointRecord | undefined;
  events: ChatEventRecord[];
  messages: ChatMessageRecord[];
}

export function buildThoughtItemsFromFields(input: ThoughtItemsInput) {
  return buildThoughtItems({
    checkpoint: input.checkpoint,
    events: input.events,
    messages: input.messages
  });
}
```

If `buildThoughtItems` currently requires the full chat facade, migrate its internals to accept `ThoughtItemsInput` directly and keep a thin compat wrapper only if tests still use the old function.

- [ ] **Step 4: Update `chat-home-page.tsx` dependencies**

Replace:

```tsx
const thoughtItems = useMemo(() => buildThoughtItems(chat), [chat]);
```

with:

```tsx
const thoughtItems = useMemo(
  () =>
    buildThoughtItemsFromFields({
      checkpoint: chat.checkpoint,
      events: chat.events,
      messages: chat.messages
    }),
  [chat.checkpoint, chat.events, chat.messages]
);
```

- [ ] **Step 5: Update `chat-home-workbench.tsx` dependencies**

Replace whole `props.chat` dependencies with concrete fields:

```tsx
const quickActionChips = useMemo(
  () =>
    buildQuickActionChips({
      activeSession: props.chat.activeSession,
      checkpoint: props.chat.checkpoint,
      isRequesting: props.chat.isRequesting
    }),
  [props.chat.activeSession, props.chat.checkpoint, props.chat.isRequesting]
);
```

Apply the same pattern to workspace snapshot, vault signals, and follow-up actions. If a helper still needs many fields, define a small input type with exactly those fields.

- [ ] **Step 6: Run chat tests and typecheck**

Run:

```bash
pnpm --dir apps/frontend/agent-chat turbo:test:unit -- test/pages/chat-home/chat-home-page.test.tsx test/pages/chat-home/chat-home-workbench.render.test.tsx test/hooks/chat-session/use-chat-session-hook.test.ts
pnpm --dir apps/frontend/agent-chat typecheck
```

Expected: pass. Confirm existing tests still cover optimistic user message and assistant loading draft behavior.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/agent-chat/src/pages/chat-home apps/frontend/agent-chat/test/pages/chat-home apps/frontend/agent-chat/test/hooks/chat-session/use-chat-session-hook.test.ts
git commit -m "refactor(agent-chat): narrow chat-home render dependencies"
```

---

### Task 8: Consolidate `agent-admin` Refresh Intent

**Files:**

- Create: `apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-refresh-intent.ts`
- Modify: `apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts`
- Test: `apps/frontend/agent-admin/test/hooks/admin-dashboard/admin-dashboard-refresh-intent.test.ts`
- Test: `apps/frontend/agent-admin/test/hooks/admin-dashboard/use-admin-dashboard-hook.test.ts`

- [ ] **Step 1: Write refresh intent helper tests**

Create `apps/frontend/agent-admin/test/hooks/admin-dashboard/admin-dashboard-refresh-intent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildAdminDashboardRefreshIntent } from '@/hooks/admin-dashboard/admin-dashboard-refresh-intent';

describe('buildAdminDashboardRefreshIntent', () => {
  it('includes runtime filters only for runtime page refreshes', () => {
    expect(
      buildAdminDashboardRefreshIntent({
        page: 'runtime',
        runtimeFilters: {
          status: 'running',
          model: 'gpt',
          pricingSource: '',
          executionMode: 'all',
          interactionKind: 'all'
        },
        approvalFilters: { executionMode: 'all', interactionKind: 'all' },
        evalFilters: { scenario: '', outcome: '' }
      })
    ).toEqual({
      page: 'runtime',
      filters: { status: 'running', model: 'gpt', pricingSource: '', executionMode: 'all', interactionKind: 'all' }
    });
  });

  it('includes approval filters only for approvals page refreshes', () => {
    expect(
      buildAdminDashboardRefreshIntent({
        page: 'approvals',
        runtimeFilters: { status: '', model: '', pricingSource: '', executionMode: 'all', interactionKind: 'all' },
        approvalFilters: { executionMode: 'auto', interactionKind: 'approval' },
        evalFilters: { scenario: '', outcome: '' }
      })
    ).toEqual({
      page: 'approvals',
      filters: { executionMode: 'auto', interactionKind: 'approval' }
    });
  });
});
```

- [ ] **Step 2: Implement refresh intent helper**

Create `apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-refresh-intent.ts`:

```ts
import type { DashboardPageKey } from '@/types/admin';

export interface RuntimeRefreshFilters {
  executionMode: string;
  interactionKind: string;
  model: string;
  pricingSource: string;
  status: string;
}

export interface ApprovalRefreshFilters {
  executionMode: string;
  interactionKind: string;
}

export interface EvalRefreshFilters {
  outcome: string;
  scenario: string;
}

export interface AdminDashboardRefreshIntentInput {
  approvalFilters: ApprovalRefreshFilters;
  evalFilters: EvalRefreshFilters;
  page: DashboardPageKey;
  runtimeFilters: RuntimeRefreshFilters;
}

export function buildAdminDashboardRefreshIntent(input: AdminDashboardRefreshIntentInput) {
  if (input.page === 'runtime') {
    return { page: input.page, filters: input.runtimeFilters } as const;
  }
  if (input.page === 'approvals') {
    return { page: input.page, filters: input.approvalFilters } as const;
  }
  if (input.page === 'evals') {
    return { page: input.page, filters: input.evalFilters } as const;
  }
  return { page: input.page, filters: {} } as const;
}
```

- [ ] **Step 3: Replace multiple refresh effects with one intent effect**

In `use-admin-dashboard.ts`, build a memoized intent:

```ts
const refreshIntent = useMemo(
  () =>
    buildAdminDashboardRefreshIntent({
      page,
      runtimeFilters: {
        status: filters.runtimeStatusFilter,
        model: filters.runtimeModelFilter,
        pricingSource: filters.runtimePricingSourceFilter,
        executionMode: filters.runtimeExecutionModeFilter,
        interactionKind: filters.runtimeInteractionKindFilter
      },
      approvalFilters: {
        executionMode: filters.approvalsExecutionModeFilter,
        interactionKind: filters.approvalsInteractionKindFilter
      },
      evalFilters: {
        scenario: filters.evalScenarioFilter,
        outcome: filters.evalOutcomeFilter
      }
    }),
  [page, filters]
);
```

Replace the separate page/runtime/approvals/evals effects with:

```ts
useEffect(() => {
  if (consoleDataRef.current) {
    void actions.refreshPageCenter(refreshIntent.page);
  }
}, [actions, refreshIntent]);
```

- [ ] **Step 4: Run admin dashboard tests**

Run:

```bash
pnpm --dir apps/frontend/agent-admin turbo:test:unit -- test/hooks/admin-dashboard/admin-dashboard-refresh-intent.test.ts test/hooks/admin-dashboard/use-admin-dashboard-hook.test.ts
pnpm --dir apps/frontend/agent-admin typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts apps/frontend/agent-admin/src/hooks/admin-dashboard/admin-dashboard-refresh-intent.ts apps/frontend/agent-admin/test/hooks/admin-dashboard
git commit -m "refactor(agent-admin): consolidate dashboard refresh intent"
```

---

### Task 9: Split `codex-chat` Pure Runtime Helpers

**Files:**

- Create: `apps/frontend/codex-chat/src/runtime/codex-chat-message.ts`
- Create: `apps/frontend/codex-chat/src/runtime/codex-chat-events.ts`
- Create: `apps/frontend/codex-chat/src/runtime/codex-chat-title.ts`
- Modify: `apps/frontend/codex-chat/src/components/codex-chat-shell.tsx`
- Test: `apps/frontend/codex-chat/test/codex-chat-runtime.test.ts`

- [ ] **Step 1: Write pure runtime tests**

Create `apps/frontend/codex-chat/test/codex-chat-runtime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { sanitizeGeneratedTitle, fallbackTitleFromMessage } from '@/runtime/codex-chat-title';
import { readPayloadText, streamTerminalEvents } from '@/runtime/codex-chat-events';
import { toUiMessage } from '@/runtime/codex-chat-message';

describe('codex chat runtime helpers', () => {
  it('sanitizes generated title responses', () => {
    expect(sanitizeGeneratedTitle('标题： “实现 React 性能优化！”')).toBe('实现 React 性能优化');
  });

  it('falls back to compact user message titles', () => {
    expect(fallbackTitleFromMessage('  请帮我重构前端性能  ')).toBe('请帮我重构前端性能');
  });

  it('reads payload text from known streaming fields', () => {
    expect(readPayloadText({ delta: 'hello' })).toBe('hello');
    expect(readPayloadText({ finalResponse: 'done' })).toBe('done');
  });

  it('maps persisted messages into UI messages', () => {
    expect(toUiMessage({ id: 'm1', role: 'assistant', content: 'hello' }).message.content).toBe('hello');
  });

  it('marks terminal stream events', () => {
    expect(streamTerminalEvents.has('final_response_completed')).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing runtime tests**

Run:

```bash
pnpm --dir apps/frontend/codex-chat turbo:test:unit -- test/codex-chat-runtime.test.ts
```

Expected: fail because runtime helper files do not exist.

- [ ] **Step 3: Extract title helpers**

Move `sanitizeGeneratedTitle`, `fallbackTitleFromMessage`, `readString`, and title payload helpers into `codex-chat-title.ts`. Export only:

```ts
export function sanitizeGeneratedTitle(raw: string) {}
export function fallbackTitleFromMessage(message: string) {}
```

Keep helper functions private.

- [ ] **Step 4: Extract event helpers**

Move stream event sets and payload text readers into `codex-chat-events.ts`:

```ts
export const streamTerminalEvents = new Set([
  'final_response_completed',
  'assistant_message',
  'session_finished',
  'session_failed'
]);

export const approvalEvents = new Set(['approval_required', 'interrupt_pending', 'execution_step_blocked']);

export const approvePattern = /^(执行|继续|同意|确认|批准|可以|好的|好|approve|yes|ok)\b/i;
export const rejectPattern = /^(取消|停止|拒绝|不要|不用|abort|reject|cancel|no)\b/i;

export function readPayloadText(payload: Record<string, unknown>) {
  return (
    readString(payload.content) ??
    readString(payload.delta) ??
    readString(payload.text) ??
    readString(payload.message) ??
    readString(payload.finalResponse) ??
    ''
  );
}
```

- [ ] **Step 5: Extract message helpers**

Move `UiMessage`, `UiMessageStatus`, `toUiMessage`, `updateAssistantDraft`, `updateAssistantSteps`, `syncEvent`, and related message helpers into `codex-chat-message.ts`.

Export:

```ts
export type UiMessageStatus = 'local' | 'loading' | 'updating' | 'success' | 'error';

export interface UiMessage {
  id: string;
  message: CodexChatMessage;
  status: UiMessageStatus;
}

export function toUiMessage(record: ChatMessageRecord): UiMessage {}
export function syncEvent(messages: UiMessage[], event: ChatEventRecord): UiMessage[] {}
```

- [ ] **Step 6: Update shell imports**

In `codex-chat-shell.tsx`, remove local helper definitions and import from runtime files:

```tsx
import { approvePattern, rejectPattern, streamTerminalEvents } from '@/runtime/codex-chat-events';
import { fallbackTitleFromMessage, sanitizeGeneratedTitle } from '@/runtime/codex-chat-title';
import { syncEvent, toUiMessage, type UiMessage } from '@/runtime/codex-chat-message';
```

- [ ] **Step 7: Run tests, typecheck, and line count**

Run:

```bash
pnpm --dir apps/frontend/codex-chat turbo:test:unit -- test/codex-chat-runtime.test.ts
pnpm --dir apps/frontend/codex-chat typecheck
wc -l apps/frontend/codex-chat/src/components/codex-chat-shell.tsx
```

Expected: tests and typecheck pass. Shell should be smaller but may still exceed 400 lines until Task 10.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/codex-chat/src/runtime apps/frontend/codex-chat/src/components/codex-chat-shell.tsx apps/frontend/codex-chat/test/codex-chat-runtime.test.ts
git commit -m "refactor(codex-chat): extract runtime helpers"
```

---

### Task 10: Split `codex-chat` Session Hook And Layout

**Files:**

- Create: `apps/frontend/codex-chat/src/runtime/codex-chat-stream.ts`
- Create: `apps/frontend/codex-chat/src/hooks/use-codex-chat-session.ts`
- Create: `apps/frontend/codex-chat/src/components/codex-chat-layout.tsx`
- Modify: `apps/frontend/codex-chat/src/components/codex-chat-shell.tsx`
- Test: `apps/frontend/codex-chat/test/codex-chat-shell.test.tsx`

- [ ] **Step 1: Write shell behavior test**

Create `apps/frontend/codex-chat/test/codex-chat-shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CodexChatShell } from '@/components/codex-chat-shell';

vi.mock('@/api/chat-api', () => ({
  chatApi: {
    listSessions: vi.fn().mockResolvedValue([]),
    listMessages: vi.fn().mockResolvedValue([])
  }
}));

describe('CodexChatShell', () => {
  it('renders the empty chat welcome state', async () => {
    render(<CodexChatShell />);

    expect(await screen.findByText('Codex Chat')).toBeTruthy();
  });
});
```

Use the current visible welcome copy if it differs from `Codex Chat`.

- [ ] **Step 2: Extract stream helper**

Create `apps/frontend/codex-chat/src/runtime/codex-chat-stream.ts`:

```ts
export function buildCodexChatStreamUrl(sessionId: string) {
  return `/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}`;
}

export function closeEventSource(source: EventSource | null) {
  source?.close();
}
```

- [ ] **Step 3: Extract `useCodexChatSession`**

Create `apps/frontend/codex-chat/src/hooks/use-codex-chat-session.ts` and move state/action logic from shell into the hook. Export a stable facade:

```ts
export interface CodexChatSessionView {
  activeMessages: UiMessage[];
  activeSessionId: string;
  createConversation(): Promise<ChatSessionRecord>;
  deleteConversation(sessionId: string): Promise<void>;
  isRequesting: boolean;
  renameConversation(): Promise<void>;
  sendMessage(content: string): Promise<void>;
  sessions: ChatSessionRecord[];
  streamError: string;
}
```

The hook owns:

- sessions state
- active session state
- message map state
- EventSource lifecycle
- generated title guard
- send/approve/reject flow

Keep network request ordering unchanged in this task.

- [ ] **Step 4: Extract layout component**

Create `apps/frontend/codex-chat/src/components/codex-chat-layout.tsx`. It receives the hook facade plus rendering callbacks and contains the JSX previously inside shell:

```tsx
export interface CodexChatLayoutProps {
  chat: CodexChatSessionView;
}

export function CodexChatLayout({ chat }: CodexChatLayoutProps) {
  return <XProvider>{/* move existing sidebar, message list, composer, modals here */}</XProvider>;
}
```

Move JSX exactly; do not redesign UI.

- [ ] **Step 5: Shrink shell**

Modify `codex-chat-shell.tsx`:

```tsx
import { CodexChatLayout } from './codex-chat-layout';
import { useCodexChatSession } from '@/hooks/use-codex-chat-session';

export function CodexChatShell() {
  const chat = useCodexChatSession();
  return <CodexChatLayout chat={chat} />;
}
```

- [ ] **Step 6: Run tests, typecheck, build, and line count**

Run:

```bash
pnpm --dir apps/frontend/codex-chat turbo:test:unit -- test/codex-chat-runtime.test.ts test/codex-chat-shell.test.tsx
pnpm --dir apps/frontend/codex-chat typecheck
pnpm --dir apps/frontend/codex-chat build
wc -l apps/frontend/codex-chat/src/components/codex-chat-shell.tsx
```

Expected: tests, typecheck, and build pass. Shell file is under 400 lines.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/codex-chat/src/runtime/codex-chat-stream.ts apps/frontend/codex-chat/src/hooks/use-codex-chat-session.ts apps/frontend/codex-chat/src/components/codex-chat-layout.tsx apps/frontend/codex-chat/src/components/codex-chat-shell.tsx apps/frontend/codex-chat/test/codex-chat-shell.test.tsx
git commit -m "refactor(codex-chat): split session hook and layout"
```

---

### Task 11: Version `knowledge` Token Storage

**Files:**

- Modify: `apps/frontend/knowledge/src/api/token-storage.ts`
- Modify: `apps/frontend/knowledge/src/api/auth-client.ts`
- Test: `apps/frontend/knowledge/test/token-storage.test.ts`
- Test: `apps/frontend/knowledge/test/auth-client.test.ts`

- [ ] **Step 1: Add token storage compatibility tests**

Update `apps/frontend/knowledge/test/token-storage.test.ts`:

```ts
it('reads legacy four-key tokens and migrates them to versioned storage', () => {
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'access');
  localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, 'refresh');
  localStorage.setItem(AUTH_STORAGE_KEYS.accessTokenExpiresAt, String(Date.now() + 60_000));
  localStorage.setItem(AUTH_STORAGE_KEYS.refreshTokenExpiresAt, String(Date.now() + 120_000));

  const tokens = readTokens();

  expect(tokens?.accessToken).toBe('access');
  expect(localStorage.getItem(AUTH_STORAGE_KEYS.versionedTokens)).toContain('"version":1');
});

it('clears corrupted versioned storage', () => {
  localStorage.setItem(AUTH_STORAGE_KEYS.versionedTokens, '{broken');

  expect(readTokens()).toBeUndefined();
  expect(localStorage.getItem(AUTH_STORAGE_KEYS.versionedTokens)).toBeNull();
});
```

- [ ] **Step 2: Run failing token tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/token-storage.test.ts test/auth-client.test.ts
```

Expected: fail because `versionedTokens` key and migration do not exist.

- [ ] **Step 3: Implement versioned token schema**

Modify `token-storage.ts`:

```ts
export const AUTH_STORAGE_KEYS = {
  versionedTokens: 'knowledge_auth_tokens',
  accessToken: 'knowledge_access_token',
  refreshToken: 'knowledge_refresh_token',
  accessTokenExpiresAt: 'knowledge_access_token_expires_at',
  refreshTokenExpiresAt: 'knowledge_refresh_token_expires_at'
} as const;

interface VersionedStoredTokens extends StoredTokens {
  version: 1;
}
```

Write `saveTokens` to store a single JSON value at `versionedTokens` and remove legacy keys after successful write.

Write `readTokens` to:

1. Try versioned JSON.
2. If missing, read legacy keys.
3. If legacy keys are valid, migrate to versioned storage.
4. If versioned JSON is corrupt, clear all token keys and return `undefined`.

- [ ] **Step 4: Cache tokens in `AuthClient`**

Modify `auth-client.ts`:

```ts
private cachedTokens = readTokens();
```

Update token accessors:

```ts
getAccessToken() {
  return this.cachedTokens?.accessToken ?? null;
}

getRefreshToken() {
  return this.cachedTokens?.refreshToken ?? null;
}

private setTokens(tokens: AuthTokens) {
  saveTokens(tokens);
  this.cachedTokens = readTokens();
}
```

Call `setTokens` after login and refresh. Clear cache after logout and auth lost.

- [ ] **Step 5: Run token tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge turbo:test:unit -- test/token-storage.test.ts test/auth-client.test.ts
pnpm --dir apps/frontend/knowledge typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/knowledge/src/api/token-storage.ts apps/frontend/knowledge/src/api/auth-client.ts apps/frontend/knowledge/test/token-storage.test.ts apps/frontend/knowledge/test/auth-client.test.ts
git commit -m "refactor(knowledge): version auth token storage"
```

---

### Task 12: Final Verification And Documentation

**Files:**

- Modify: `docs/apps/frontend/knowledge/knowledge-chat-lab.md` if query behavior changed user-visible loading semantics.
- Modify: `docs/apps/frontend/agent-admin/overview.md` if center lazy loading changes operational notes.
- Modify: `docs/apps/frontend/codex-chat/README.md` to document runtime split.
- Modify: `docs/apps/frontend/agent-chat/README.md` if chat-home projection boundaries are now documented.

- [ ] **Step 1: Run affected frontend verification**

Run:

```bash
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge turbo:test:unit
pnpm --dir apps/frontend/agent-admin typecheck
pnpm --dir apps/frontend/agent-admin turbo:test:unit
pnpm --dir apps/frontend/agent-chat typecheck
pnpm --dir apps/frontend/agent-chat turbo:test:unit
pnpm --dir apps/frontend/codex-chat typecheck
pnpm --dir apps/frontend/codex-chat build
```

Expected: all pass. If an unrelated existing failure blocks a command, record the exact failing test or diagnostic in the final delivery note and continue with the remaining affected commands.

- [ ] **Step 2: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: pass.

- [ ] **Step 3: Update module docs**

Update only docs whose module behavior changed:

- `docs/apps/frontend/knowledge/knowledge-chat-lab.md`: mention React Query handles request dedupe and cache for knowledge data hooks if visible in usage notes.
- `docs/apps/frontend/agent-admin/overview.md`: mention low-frequency centers and chart panels are lazy loaded if relevant for local debugging.
- `docs/apps/frontend/codex-chat/README.md`: document `runtime/`, `hooks/`, and layout boundaries.
- `docs/apps/frontend/agent-chat/README.md`: document that chat-home projection helpers should accept explicit fields, not whole chat facade.

- [ ] **Step 4: Re-run docs check**

Run:

```bash
pnpm check:docs
```

Expected: pass.

- [ ] **Step 5: Commit docs and final cleanup**

```bash
git add docs/apps/frontend/knowledge/knowledge-chat-lab.md docs/apps/frontend/agent-admin/overview.md docs/apps/frontend/codex-chat/README.md docs/apps/frontend/agent-chat/README.md
git commit -m "docs(frontend): document react performance refactor boundaries"
```

## Plan Self-Review

- Spec coverage: Tasks 1-3 cover bundle splitting; Tasks 4-6 cover `knowledge` Query migration and observability waterfall; Tasks 7-8 cover render dependencies and admin refresh intent; Tasks 9-11 cover `codex-chat`, token storage, and storage caching; Task 12 covers docs and verification.
- Completion scan: no incomplete implementation step, and each code-changing step includes concrete code or exact replacement shape.
- Type consistency: query key names, hook names, and runtime module names are introduced before later tasks reference them.
- Scope check: this plan is broad but intentionally staged. Each task is independently testable and can be split into a sub-plan if execution needs smaller batches.
