# Preview Pro Welcome Content Specification

状态：snapshot
文档类型：reference
适用范围：`apps/frontend/knowledge/src/pages/overview/overview-page.tsx`
最后核对：2026-05-01

## Overview

- Target file: `apps/frontend/knowledge/src/pages/overview/overview-page.tsx`
- Screenshot: `docs/design-references/preview-pro-ant-design/welcome-desktop.png`
- Interaction model: static content with ordinary link hover states.

## DOM Structure

- Page title: `欢迎使用 Ant Design Pro V6🎉`
- Main content card
  - Heading: `Ant Design Pro Cheatsheet`
  - Badge row: GitHub, Stars, Node.js
  - Banner image
  - Feature section: `🎉 v6 新特性`
  - Quick start section: `快速开始`
  - Commands table
  - Routes/Layout/Data/Request/Permission/i18n/Style/Test/FAQ sections
- Right quick cards
  - `了解 umi`
  - `了解 Ant Design`
  - `了解 Pro Components`

## Assets

- Banner image: `/pro-welcome-assets/welcome-preview.png`

## Text

Use the visible Chinese content from the live welcome page screenshot. Long code examples can be shortened while preserving section names and visual rhythm because this is embedded inside the existing knowledge app, not a standalone documentation site.
