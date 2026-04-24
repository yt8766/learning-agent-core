# Data Report Bundle Agent Redesign Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/core`、`agents/data-report`、`apps/backend/agent-server`
最后核对：2026-04-23

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `ReportBundle` as the canonical internal report contract, route `/api/chat` report-schema execution through new bundle-aware generate/edit facades, and preserve single-document compatibility for existing consumers.

**Architecture:** Add schema-first bundle/document/patch contracts in `packages/core`, build a thin bundle-aware runtime facade in backend that reuses the existing `/api/chat` transport, and start migration by projecting single-document compatibility from the canonical bundle result. Brand-new generation and patch editing stay behind backend facades so the external HTTP path remains unchanged while the internal contract becomes bundle-first.

**Tech Stack:** TypeScript, Zod, Vitest, NestJS backend facade pattern, existing `@agent/platform-runtime` / `@agent/core` contracts.

---

### Task 1: Add Core Bundle Contracts

**Files:**

- Create: `packages/core/src/data-report/schemas/report-bundle.ts`
- Create: `packages/core/src/data-report/types/report-bundle.ts`
- Create: `packages/core/src/contracts/data-report/report-bundle.ts`
- Modify: `packages/core/src/contracts/data-report/index.ts`
- Modify: `packages/core/src/data-report/index.ts`
- Test: `packages/core/test/report-bundle-contracts.test.ts`
- Test: `packages/core/test/core-contract-exports.int-spec.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest';
import { ReportBundleSchema } from '../src/data-report/schemas/report-bundle';

describe('@agent/core report bundle contracts', () => {
  it('parses a single-document bundle with patch operations', () => {
    const parsed = ReportBundleSchema.parse({
      version: 'report-bundle.v1',
      kind: 'report-bundle',
      meta: { bundleId: 'bundle-1', title: 'Bonus Center', mode: 'single-document' },
      documents: [
        {
          version: '1.0',
          kind: 'data-report-json',
          meta: {
            reportId: 'bonusCenterData',
            title: 'Bonus Center',
            scope: 'multiple'
          },
          filterSchema: { formKey: 'search', fields: [] },
          dataSources: {},
          sections: [],
          modification: { strategy: 'patch-operations', supportedOperations: ['rename-table'] }
        }
      ],
      patchOperations: [
        {
          op: 'rename-table',
          documentId: 'bonusCenterData',
          sectionId: 'exchangeMall',
          blockId: 'table-1',
          summary: 'rename table',
          value: { title: '兑换明细' }
        }
      ]
    });

    expect(parsed.documents).toHaveLength(1);
    expect(parsed.patchOperations?.[0]?.op).toBe('rename-table');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run packages/core/test/report-bundle-contracts.test.ts`
Expected: FAIL because `ReportBundleSchema` does not exist yet.

- [ ] **Step 3: Add minimal schema and type exports**

```ts
export const ReportPatchOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('rename-table'),
    documentId: z.string().min(1),
    sectionId: z.string().min(1),
    blockId: z.string().min(1),
    summary: z.string().min(1),
    value: z.object({ title: z.string().min(1) })
  })
]);

export const ReportDocumentSchema = DataReportJsonSchemaSchema.extend({
  modification: z.object({
    strategy: z.literal('patch-operations'),
    supportedOperations: z.array(z.string().min(1))
  })
});

export const ReportBundleSchema = z.object({
  version: z.literal('report-bundle.v1'),
  kind: z.literal('report-bundle'),
  meta: z.object({
    bundleId: z.string().min(1),
    title: z.string().min(1),
    mode: z.enum(['single-document', 'multi-document'])
  }),
  documents: z.array(ReportDocumentSchema),
  patchOperations: z.array(ReportPatchOperationSchema).optional(),
  warnings: z.array(z.string()).optional()
});
```

- [ ] **Step 4: Re-export through the core barrels**

```ts
export * from './report-bundle';
```

- [ ] **Step 5: Extend export integration coverage**

```ts
expectTypeOf<ReportBundle>().toEqualTypeOf<DirectReportBundle>();
expect(ReportBundleSchema).toBe(DirectReportBundleSchema);
```

- [ ] **Step 6: Run the focused tests**

Run: `pnpm exec vitest run packages/core/test/report-bundle-contracts.test.ts packages/core/test/core-contract-exports.int-spec.ts`
Expected: PASS

### Task 2: Add Backend Bundle Compatibility Helpers

**Files:**

- Create: `apps/backend/agent-server/src/runtime/core/runtime-report-bundle-facade.ts`
- Create: `apps/backend/agent-server/src/chat/chat-report-bundle-compat.ts`
- Modify: `apps/backend/agent-server/src/runtime/core/runtime-data-report-facade.ts`
- Test: `apps/backend/agent-server/test/chat/chat.report-bundle-compat.spec.ts`

- [ ] **Step 1: Write the failing backend compatibility test**

```ts
import { describe, expect, it } from 'vitest';
import { buildReportBundleFromSchema } from '../../src/chat/chat-report-bundle-compat';

describe('chat report bundle compatibility', () => {
  it('wraps a schema into a single-document bundle', () => {
    const bundle = buildReportBundleFromSchema({
      version: '1.0',
      kind: 'data-report-json',
      meta: { reportId: 'bonusCenterData', title: 'Bonus Center', scope: 'multiple', owner: 'data-report-json-agent' },
      filterSchema: { formKey: 'search', fields: [] },
      dataSources: {},
      sections: [],
      modification: { strategy: 'patch-operations', supportedOperations: [] }
    });

    expect(bundle.meta.mode).toBe('single-document');
    expect(bundle.documents).toHaveLength(1);
    expect(bundle.documents[0]?.meta.reportId).toBe('bonusCenterData');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run apps/backend/agent-server/test/chat/chat.report-bundle-compat.spec.ts`
Expected: FAIL because the compatibility helpers do not exist yet.

- [ ] **Step 3: Implement the minimal compatibility helpers**

```ts
export function buildReportBundleFromSchema(schema: DataReportJsonSchema): ReportBundle {
  return {
    version: 'report-bundle.v1',
    kind: 'report-bundle',
    meta: {
      bundleId: schema.meta.reportId,
      title: schema.meta.title,
      mode: 'single-document'
    },
    documents: [schema]
  };
}
```

- [ ] **Step 4: Add a thin backend facade host type**

```ts
export interface ReportBundleGenerateResult {
  bundle: ReportBundle;
  runtime?: DataReportJsonRuntimeMeta;
}

export function buildBundleFacadeFromLegacySchema(schema: DataReportJsonSchema) {
  return { bundle: buildReportBundleFromSchema(schema) };
}
```

- [ ] **Step 5: Run the focused test**

Run: `pnpm exec vitest run apps/backend/agent-server/test/chat/chat.report-bundle-compat.spec.ts`
Expected: PASS

### Task 3: Route `/api/chat` Report Schema Results Through Bundle Compatibility

**Files:**

- Modify: `apps/backend/agent-server/src/chat/chat-report-schema.helpers.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.direct.dto.ts`
- Modify: `apps/backend/agent-server/src/runtime/core/runtime-data-report-facade.ts`
- Test: `apps/backend/agent-server/test/chat/chat.service.report-schema-core.spec.ts`

- [ ] **Step 1: Write the failing compatibility assertion**

```ts
expect(result.bundle?.kind).toBe('report-bundle');
expect(result.schema?.meta.reportId).toBe('bonusCenterData');
```

- [ ] **Step 2: Run the report schema test to verify it fails**

Run: `pnpm exec vitest run apps/backend/agent-server/test/chat/chat.service.report-schema-core.spec.ts`
Expected: FAIL because report schema results do not expose bundle compatibility yet.

- [ ] **Step 3: Extend the result contract in the helper path**

```ts
const bundle = buildReportBundleFromSchema(graphResult.schema);

onEvent({
  type: 'schema_ready',
  data: {
    schema: graphResult.schema,
    bundle,
    reportSummaries: graphResult.reportSummaries,
    runtime: graphResult.runtime
  }
});

return {
  ...graphResult,
  bundle,
  schema: graphResult.schema as DataReportJsonSchema
};
```

- [ ] **Step 4: Keep `/api/chat` transport unchanged**

```ts
// No controller path changes. The helper now returns both canonical bundle and the primaryDocument schema.
```

- [ ] **Step 5: Run the focused backend tests**

Run: `pnpm exec vitest run apps/backend/agent-server/test/chat/chat.report-bundle-compat.spec.ts apps/backend/agent-server/test/chat/chat.service.report-schema-core.spec.ts`
Expected: PASS

### Task 4: Document the Current Canonical Compatibility Boundary

**Files:**

- Modify: `docs/backend/2026-04-23-data-report-bundle-agent-redesign.md` (if implementation notes are needed)
- Modify: `docs/report-kit/data-report-json-bundle.md`

- [ ] **Step 1: Add a short implementation status note**

```md
- External transport remains `POST /api/chat`
- Internal canonical object is now `ReportBundle`
- Single-document consumers continue to read `bundle.documents[0]` compatibility projections
```

- [ ] **Step 2: Run docs validation**

Run: `pnpm check:docs`
Expected: PASS

### Task 5: Verify the First Increment

**Files:**

- Test only

- [ ] **Step 1: Run focused Type + Spec + Unit checks**

Run: `pnpm exec tsc -p packages/core/tsconfig.json --noEmit && pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit && pnpm exec vitest run packages/core/test/report-bundle-contracts.test.ts packages/core/test/core-contract-exports.int-spec.ts apps/backend/agent-server/test/chat/chat.report-bundle-compat.spec.ts apps/backend/agent-server/test/chat/chat.service.report-schema-core.spec.ts`
Expected: PASS

- [ ] **Step 2: Run repo-level docs verification**

Run: `pnpm check:docs`
Expected: PASS

- [ ] **Step 3: Inline completion checkpoint**

```text
Record which old helpers still remain, which new bundle surfaces are canonical, and what the next implementation slice is: Generate Agent / Patch Agent runtime replacement.
```
