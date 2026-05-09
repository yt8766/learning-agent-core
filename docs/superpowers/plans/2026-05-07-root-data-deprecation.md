# Root Data Deprecation Implementation Plan

状态：current
文档类型：plan
适用范围：`apps/backend/agent-server`、`packages/runtime`、`packages/memory`、`packages/knowledge`、`packages/skill`、`packages/tools`、`agents/intel-engine`、root `data/` cleanup
最后核对：2026-05-09

> Historical note, 2026-05-09: this was the original root `data/*`
> deprecation plan. It remains useful for migration context, but it is not the
> current execution guide. Continue current deletion-completion work from
> `docs/superpowers/plans/2026-05-09-root-data-removal-completion.md`.
> Runtime persistence now uses explicit repositories/storage facades,
> `profile-storage/<profile>/...` local fallback, or `artifacts/...`; root
> `data/*` is legacy migration input only.

> Historical note: do not update this plan as the active checklist. Keep it as
> context for older migration phases, and update the 2026-05-09 completion plan
> for current root data removal work.

## Goal

Retire repository-root `data/` as runtime persistence. Durable state should move behind explicit memory/Postgres repositories or artifact/storage facades. Memory mode remains explicit and ephemeral. Root `data/*` may remain only as legacy import or clearly marked transitional fallback until each domain cutover is complete.

Reference spec: `docs/superpowers/specs/2026-05-07-root-data-deprecation-design.md`.

## Historical Status Snapshot

Historical note: the status below reflects the migration state around
2026-05-08. Some items may have since moved forward; verify current state with
the 2026-05-09 completion plan and repository checks before acting.

- [x] Add repository-wide root-data runtime guard.
  - Added `scripts/check-no-root-data-runtime.mjs`.
  - Added root script `pnpm check:no-root-data-runtime`.
  - The guard currently passes with structured transitional allowlist hits.

- [ ] Phase 3: finish skill persistence cutover.
  - Complete repository/facade contracts for skill install receipts, source metadata, source cache, workspace drafts, and artifact staging.
  - Wire production runtime paths to injected repositories first.
  - Keep `.agents/skills/*` as source-controlled agent skills.
  - Remaining transitional root-data hits include skill staging, workspace drafts, remote source cache, and sandbox skill metadata paths.

- [ ] Phase 4: memory, rules, and semantic cache cutover.
  - Current slice:
    - Added semantic cache schema, repository contract, in-memory implementation, and file repository schema validation in `packages/memory`.
    - Added tests proving semantic cache can run without root `data/runtime/semantic-cache.json` writes.
  - Add explicit repository contracts and memory/Postgres implementations for memory records, rules, evidence links, profiles, reflections, and semantic cache.
  - Memory mode must not write root `data/memory` or `data/runtime/semantic-cache.json`.

- [ ] Phase 5: knowledge and operational runtime persistence cutover.
  - Current slice:
    - `packages/knowledge` local knowledge store now supports injected snapshot repository/runtime paths/source provider.
    - Tests prove injected knowledge snapshot storage does not create or depend on root `data/knowledge`.
  - Stop runtime knowledge search/store code from reading root `data/knowledge` or `data/runtime` directly.
  - Move intel briefing, schedules, connector drafts, cancellations, recoveries, and governance artifacts behind owning repositories or facades.

- [ ] Phase 6: generated/browser/tool artifact cutover.
  - Current slice:
    - Runtime browser sandbox now supports injected browser replay artifact writer and returns stable artifact ids/URLs.
    - Tests prove the injected browser artifact writer path does not write root `data/browser-replays`.
  - Replace root `data/browser-replays` and `data/generated` writes with artifact repository/facade outputs.
  - Runtime sandbox/browser tools should return stable artifact ids or URLs.

- [ ] Phase 7: legacy import and root data removal.
  - Current slice:
    - Added backend-owned `LEGACY_DATA_IMPORT=once` runner skeleton in `apps/backend/agent-server/src/runtime/legacy-data-import`.
    - Runner reads old `data/runtime`, `data/memory`, `data/rules`, `data/knowledge`, and `data/skills` `.json` / `.jsonl` files, writes stable receipts/errors, skips already receipted payloads on repeat runs, and does not delete or mutate source files.
    - Added `LegacyDataImportRepository` plus in-memory and Postgres-ready SQL implementations. The SQL implementation stages payloads into `legacy_data_import_records`, `legacy_data_import_receipts`, and `legacy_data_import_errors`.
  - Remaining:
    - Wire the import repository to real memory/rules/knowledge/skills/runtime Postgres domain repositories through explicit mappers.
    - Add the final backend bootstrap call site after production ownership decides when `LEGACY_DATA_IMPORT=once` should run during process startup.
  - Remove root `data/*` defaults from `packages/config`.
  - Delete tracked root `data/rules/rules.jsonl` only after import and all production write paths are gone.
  - Rewrite docs that still describe root `data/*` as current storage.

## Verification

Run affected tests and type checks for every migrated domain, then:

```bash
pnpm check:no-root-data-runtime
pnpm check:docs
```

If public package contracts change, also run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

## Completion Criteria

The plan is complete only when:

- no production/runtime code writes root `data/runtime`, `data/memory`, `data/knowledge`, `data/skills`, `data/browser-replays`, or `data/generated`;
- Postgres mode covers durable state previously stored under root `data/*`;
- memory mode is documented and verified as ephemeral;
- legacy import can migrate old local files with receipts/errors;
- legacy import payloads are mapped into owning domain repositories, not only staged in backend-owned import tables;
- `pnpm check:no-root-data-runtime` passes without broad transitional allowlist entries;
- docs no longer present root `data/*` as current default persistence.
