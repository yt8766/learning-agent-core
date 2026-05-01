# WorkflowLabGraphCanvas Specification

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowGraphCanvas.tsx`
最后核对：2026-04-30

## Overview

- **Target file:** `apps/frontend/agent-admin/src/features/workflow-lab/components/WorkflowGraphCanvas.tsx`
- **Interaction model:** click-driven node selection with live SSE status projection
- **Reference:** LangSmith Studio Graph mode public docs; target Studio page requires authentication and could not be inspected beyond login screen.

## DOM Structure

- Root section with `data-workflow-graph-canvas="true"`.
- Header row: `Graph` label, node / edge counts, run status badge.
- Node list: one button per `workflow.graph.nodes`.
- Edge ledger: one monospace row per `workflow.graph.edges` in `from → to` format.

## State Mapping

- `succeeded`: completed node event exists and status is `succeeded`.
- `failed`: completed node event exists and status is `failed`.
- `skipped`: completed node event exists and status is `skipped`.
- `running`: run is active, no event exists for this node, and all previous path nodes succeeded.
- `pending`: no event exists and node is not currently inferred as running.

## Behaviors

- Node with a received stream event is clickable and calls `onSelectNode(event)`.
- Node without a stream event is disabled and acts as topology context only.
- Selected node receives `data-selected="true"` and a visible ring.
- Each node exposes `data-node-status` for tests and later browser QA.

## Responsive Behavior

- The component uses a single-column compact graph ledger so it remains usable in the existing `agent-admin` three-column console.
- Long node ids and labels truncate inside their own node row instead of resizing the layout.
