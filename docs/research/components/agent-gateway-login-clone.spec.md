# AgentGatewayLoginClone Specification

状态：current
文档类型：spec
适用范围：`apps/frontend/agent-gateway` 登录页视觉还原
最后核对：2026-05-10

## Overview

- **Target files**：`apps/frontend/agent-gateway/src/app/pages/LoginPage.tsx`、`apps/frontend/agent-gateway/src/app/styles/login.css`
- **Interaction model**：static split shell + username/password form controls.
- **Source reference**：`http://localhost:8317/management.html#/login`

## Structure

- `main.login-clone-shell`
  - left `section.login-brand-panel`
    - brand words `AGENT / GATEWAY / API`
  - right `section.login-form-panel`
    - fixed `80px` x `80px` AGMC logo
    - login card with title, username, management key, remember password, submit

## Current Decisions

- Project name and mark use Agent Gateway / AGMC, not CPAMC.
- Language switch, current address box, and custom connection address row are intentionally removed.
- The management key eye icon is positioned inside the password input at the right edge.
- Mobile hides the black brand panel and keeps the form full-width.
