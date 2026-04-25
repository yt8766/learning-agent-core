# Project Health Audit Implementation Plan

状态：snapshot
文档类型：plan
适用范围：仓库级项目健康审计执行步骤
最后核对：2026-04-25

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a read-only project health audit report and prioritized remediation plan for the whole monorepo.

**Architecture:** The audit is split into independent read-only tracks so multiple agents can inspect different risk surfaces in parallel. The controller owns final deduplication, priority grading, and the final report; subagents return evidence-backed findings only.

**Tech Stack:** TypeScript monorepo, pnpm, Turbo, Vitest, zod, NestJS, Vite/React, Next.js, LangGraph-style runtime packages, Markdown docs.

---

## File Structure

- Create: `docs/superpowers/plans/2026-04-25-project-health-audit.md`
  - Execution plan for the audit.
- Create after audit: `docs/superpowers/reports/2026-04-25-project-health-audit-report.md`
  - Final audit report with P0/P1/P2/P3 findings.
- Modify after audit, only if needed: `docs/superpowers/specs/2026-04-25-project-health-audit-design.md`
  - Only update if execution discovers the approved scope is missing a critical audit dimension.

The audit phase is read-only for source code. Any remediation must be proposed in the report, not implemented during this plan.

## Task 1: Worktree And Delivery State Scan

**Files:**

- Read: `package.json`
- Read: `pnpm-workspace.yaml`
- Read: `.gitignore`
- Read: `docs/project-conventions.md`
- Read: `docs/evals/verification-system-guidelines.md`
- Output section: `docs/superpowers/reports/2026-04-25-project-health-audit-report.md`

- [ ] **Step 1: Capture git and workspace status**

Run:

```bash
git status --short
git branch --show-current
git log --oneline -5
```

Expected: collect branch name, recent commits, and dirty/untracked files. Do not modify or clean anything.

- [ ] **Step 2: Check workspace package discovery**

Run:

```bash
find packages agents apps -path '*/build' -prune -o -path '*/.next' -prune -o -path '*/node_modules' -prune -o -name package.json -print | sort
```

Expected: identify real workspace packages and template package manifests; flag generated package manifests only if they can be discovered by workspace tooling.

- [ ] **Step 3: Check source artifact pollution**

Run:

```bash
find packages agents apps -path '*/build' -prune -o -path '*/.next' -prune -o -path '*/node_modules' -prune -o -path '*/src/*' -type f \( -name '*.d.ts' -o -name '*.d.ts.map' \) -print
```

Expected: source declaration artifacts are either intentional ambient declarations or flagged as possible generated artifact pollution.

## Task 2: API Documentation Consistency Audit

**Files:**

- Read: `docs/api/README.md`
- Read: `docs/api/agent-chat.md`
- Read: `docs/api/agent-admin.md`
- Read: `docs/api/runtime.md`
- Read: `docs/api/approvals.md`
- Read: `docs/api/run-observatory.md`
- Read: `apps/backend/agent-server/src`
- Read: `apps/frontend/agent-chat/src/api`
- Read: `apps/frontend/agent-chat/src/types`
- Read: `apps/frontend/agent-admin/src/api`
- Read: `apps/frontend/agent-admin/src/types`
- Output section: `docs/superpowers/reports/2026-04-25-project-health-audit-report.md`

- [ ] **Step 1: Map documented API routes and payload names**

Run:

```bash
rg -n "^(##|###)|`(GET|POST|PATCH|DELETE) |SSE|event|payload|响应|错误|兼容" docs/api
```

Expected: route and event inventory from the docs.

- [ ] **Step 2: Map backend route/controller names**

Run:

```bash
rg -n "@(Controller|Get|Post|Patch|Delete)|app/api|NextResponse|Request|Response" apps/backend apps/llm-gateway --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Expected: backend/route handler inventory, including current `apps/llm-gateway` uncommitted route work.

- [ ] **Step 3: Map frontend API consumers**

Run:

```bash
rg -n "fetch\\(|axios|EventSource|/api/|/v1/|sessionId|approval|runtime|observatory" apps/frontend apps/llm-gateway --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Expected: consumer inventory and likely undocumented field assumptions.

## Task 3: Boundary, Graph, Schema, And Duplicate Implementation Audit

**Files:**

- Read: `docs/ARCHITECTURE.md`
- Read: `docs/project-conventions.md`
- Read: `docs/runtime/runtime-layering-adr.md`
- Read: `packages/core/src`
- Read: `packages/runtime/src`
- Read: `packages/platform-runtime/src`
- Read: `agents/*/src`
- Read: `apps/backend/agent-server/src`
- Output section: `docs/superpowers/reports/2026-04-25-project-health-audit-report.md`

- [ ] **Step 1: Scan disallowed or fragile imports**

Run:

```bash
rg -n "from ('|\")(@agent/[^'\"]+/src|packages/|agents/|\\.\\./\\.\\./\\.\\./|\\.\\./\\.\\./\\.\\./\\.\\./)" apps packages agents --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Expected: classify true boundary violations separately from tests, templates, and internal same-package relative imports.

- [ ] **Step 2: Scan schema-first and parse risks**

Run:

```bash
rg -n "JSON\\.parse|z\\.object|Schema|safeParse|parse\\(" packages agents apps --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Expected: identify stable contract parsing without zod/schema protection, while excluding logs/tests/internal transient parsing where justified.

- [ ] **Step 3: Scan duplicate responsibility clusters**

Run:

```bash
rg -n "Center|center|facade|Facade|normaliz|project|projection|repository|Repository|compat|interrupt|approval|skill|governance" packages/runtime packages/platform-runtime apps/backend agents apps/frontend apps/llm-gateway --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Expected: identify repeated implementations, classify as thin compat, should converge, or behavior fork.

## Task 4: Security, Persistence, Observability, And Dependency Audit

**Files:**

- Read: `.gitignore`
- Read: `apps/llm-gateway/src`
- Read: `apps/backend/agent-server/src/logger`
- Read: `apps/backend/agent-server/src/runtime`
- Read: `packages/memory/src`
- Read: `packages/runtime/src`
- Read: all `package.json`
- Output section: `docs/superpowers/reports/2026-04-25-project-health-audit-report.md`

- [ ] **Step 1: Scan credential and secret handling**

Run:

```bash
rg -n "secret|token|api.?key|password|cookie|session|Authorization|Bearer|\\.env|hash|salt|redact|sanitize" . --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/build/**'
```

Expected: flag possible secret leakage, unsafe defaults, missing redaction, or unclear auth/session boundaries.

- [ ] **Step 2: Scan persistence and recovery surfaces**

Run:

```bash
rg -n "checkpoint|recover|recovery|cancel|interrupt|history|persist|repository|Postgres|Redis|sqlite|json|writeFile|readFile|rm\\(" packages apps agents --glob '!**/build/**' --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Expected: identify data compatibility, recovery, and deletion risks with concrete files.

- [ ] **Step 3: Scan dependency declaration risks**

Run:

```bash
find packages agents apps -path '*/build' -prune -o -path '*/.next' -prune -o -path '*/node_modules' -prune -o -name package.json -print | sort
```

Then compare package manifests against source imports with targeted `rg` searches for third-party module names.

Expected: flag obvious missing package declarations, duplicated dependency declarations, and vendor SDK leakage into business layers.

## Task 5: Engineering Quality And Frontend Runtime Audit

**Files:**

- Read: `docs/frontend-conventions.md`
- Read: `apps/frontend/agent-chat/src`
- Read: `apps/frontend/agent-admin/src`
- Read: `apps/llm-gateway/app`
- Read: `apps/llm-gateway/src`
- Read: `packages/templates/src`
- Output section: `docs/superpowers/reports/2026-04-25-project-health-audit-report.md`

- [ ] **Step 1: Scan large files and template/test placement**

Run:

```bash
find packages agents apps -path '*/build' -prune -o -path '*/.next' -prune -o -path '*/node_modules' -prune -o -path '*/src/*' -type f \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} + | sort -nr | sed -n '1,120p'
```

Expected: flag files at or above 400 lines and near-threshold files with broad responsibilities.

- [ ] **Step 2: Scan frontend dynamic imports and effects**

Run:

```bash
rg -n "import\\(|useEffect\\(|setInterval|setTimeout|EventSource|catch \\{|catch\\(" apps/frontend apps/llm-gateway --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Expected: flag dynamic imports without clear reason, effects without cleanup, polling/SSE loops, and empty or weak catch blocks.

- [ ] **Step 3: Scan UI/product role drift**

Run:

```bash
rg -n "Approval|Think|ThoughtChain|Evidence|Learning|Skill|Runtime Center|Approvals Center|Learning Center|Skill Lab|Evidence Center|Connector|Policy" apps/frontend docs/frontend docs/api
```

Expected: identify whether `agent-chat` and `agent-admin` still map to their intended product roles or have duplicated product surfaces.

## Task 6: Synthesis, Report, And Remediation Plan

**Files:**

- Create: `docs/superpowers/reports/2026-04-25-project-health-audit-report.md`
- Read: subagent summaries from Tasks 2-5
- Read: local scan results from Task 1

- [ ] **Step 1: Create report directory if missing**

Run:

```bash
ls docs/superpowers
```

Expected: if `docs/superpowers/reports` does not exist, create it before writing the report.

- [ ] **Step 2: Write the final report**

Report must include:

```markdown
# Project Health Audit Report

状态：snapshot
文档类型：note
适用范围：仓库级项目健康审计结果与修复计划
最后核对：2026-04-25

## 摘要

## P0 阻断交付

## P1 高风险漂移

## P2 可维护性债务

## P3 后续优化

## 重复实现与职责分叉

## 前后端与 API 文档一致性

## 安全、凭据与数据恢复风险

## 未提交 llm-gateway 改动风险

## 修复计划

## 验证记录
```

Each finding must include priority, issue, evidence, impact, recommendation, certainty, and handling type.

- [ ] **Step 3: Verify docs**

Run:

```bash
pnpm check:docs
```

Expected: docs check passes. If it fails due to the new report, fix the report metadata or links.

- [ ] **Step 4: Commit audit plan and report**

Run:

```bash
git add docs/superpowers/plans/2026-04-25-project-health-audit.md docs/superpowers/reports/2026-04-25-project-health-audit-report.md
git commit -m "docs: add project health audit report"
```

Expected: commit only the audit plan and report, not unrelated existing `apps/llm-gateway` work.
