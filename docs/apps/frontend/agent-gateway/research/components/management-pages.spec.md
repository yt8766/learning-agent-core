# Management Pages Specification

状态：current
文档类型：spec
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-10

## Overview

- **Target files:** `src/app/pages/{DashboardPage,ConfigEditorPage,ProviderConfigPage,AuthFilesManagerPage,OAuthPolicyPage,QuotasPage,SystemPage}.tsx`
- **Style file:** `src/app/styles/management.css`
- **Interaction model:** server-backed management projections with callback-driven buttons. Pages remain presentational; `GatewayWorkspace` owns `AgentGatewayApiClient` calls and query invalidation.

## Dashboard Clone

- Class: `dashboard-clone`, `dashboard-background-orbs`, `dashboard-hero`, `dashboard-bento-grid`.
- Layout: hero + bento stats + runtime config pills, max width 1000px.
- Animations: `dashboard-orb-float`, `dashboard-hero-enter`, `dashboard-watermark-enter`, `dashboard-fade-slide-up`, `dashboard-card-enter`, `dashboard-pulse`.
- Surface: pure white cards with light gray borders and restrained shadows.

## AI Providers Clone

- Class: `provider-config-clone`, `provider-config-card`, `provider-empty-state`, `provider-config-record`, `provider-floating-nav`.
- Provider order: Gemini API 密钥、Codex API 配置、Claude API 配置、Vertex API 配置、OpenAI 兼容配置、Ampcode 桥接配置.
- Assets: SVG icons copied from `/Users/dev/Desktop/Cli-Proxy-API-Management-Center/src/assets/icons/` into `src/app/assets/provider-icons/`.
- Interaction model: cards render `GatewayProviderSpecificConfigListResponse` records when present; add/save/test/model refresh buttons invoke the workspace callback bridge; floating nav anchors to provider sections.

## Auth Files Clone

- Class: `auth-files-clone`, `auth-filter-rail`, `auth-filter-controls`, `auth-file-grid`, `auth-file-card`, `auth-operation-strip`.
- Layout: page header + white panel + provider filter tags + search/page-size/sort/toggle controls + provider avatar cards + sticky bulk action strip.
- Interaction model: cards render `GatewayAuthFileListResponse` records when present; buttons preserve callback props for upload/download/delete/status/patch/model list.

## OAuth Login Clone

- Class: `oauth-login-clone`, `oauth-card-grid`, `oauth-login-card`, `oauth-url-box`, `oauth-policy-strip`.
- Provider order: Codex、Claude、Antigravity、Kimi.
- Layout: white provider cards with provider SVG icon and primary login button; authorization link box, callback URL field, status refresh and status badge stay collapsed until a provider start call returns an authorization URL.
- Interaction model: start/status/callback buttons call workspace-owned OAuth callbacks. Codex/Claude/Antigravity/Kimi start through `POST /api/agent-gateway/oauth/:providerId/start`; the page owns local UI state for authorization URL, state, callback URL or device user code, submission and provider status. Callback URL submission is hidden for Kimi device flow.

## Quota Management Clone

- Class: `quota-management-clone`, `quota-section-stack`, `quota-section-card`, `quota-view-toggle`, `quota-file-card`.
- Provider order: Claude、Antigravity、Codex、Gemini CLI、Kimi.
- Layout: provider sections with count badge, paged/all toggle, refresh all, quota file card, progress track and reset text; table and edit panel remain below for existing data contract visibility.

## System Info Clone

- Class: `system-info-clone`, `system-about-card`, `system-info-grid`, `system-section-card`, `system-link-grid`, `system-model-row`.
- Layout: centered about logo/title, four info tiles, quick links, grouped model chips, login/request-log actions.
- Interaction model: request log and clear login callbacks stay callback-driven; default clear only removes Agent Gateway refresh token.

## Shared Cards

- Action card: `management-action-card`, icon, h3, detail, `command-actions` remains used by secondary pages.
- Info panel: `management-info-panel`, icon/title/detail/action controls remains used by system/OAuth pages.
- Model chips: `model-chip-row` + `model-chip`.

## Page Content

- 仪表盘：管理密钥、认证文件、Provider 凭据、可用模型四项统计，并恢复参考项目动效。
- 配置面板：Agent Gateway `config.yaml` editor，diff/save/reload 按钮带图标。
- AI 提供商：6 个 provider 大卡，名称、图标、虚线空状态和底部图标浮条按参考项目还原，按钮文案改为 Agent Gateway 语义。
- 认证文件：批量操作、记录修补、浏览控制以筛选轨道、文件卡片和 sticky 操作条呈现。
- OAuth 登录：Codex/Claude/Antigravity/Kimi 登录卡 + policy shortcut strip。
- 配额管理：provider quota sections + quota card + raw quota table + edit panel。
- 管理中心信息：about card + info tiles + quick links + model chips + request-log/login actions。
