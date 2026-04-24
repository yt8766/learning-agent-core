# LLM Gateway

状态：current
文档类型：guide
适用范围：`apps/llm-gateway`
最后核对：2026-04-24

## 1. 当前定位

`apps/llm-gateway` 是私用 LLM 中转站，提供 OpenAI-compatible `/v1/*` API、管理员后台、虚拟 API Key、模型别名、用量记录和基础限额。

它部署为当前 monorepo 下的独立 Vercel app。Vercel Project 的 Root Directory 应选择 `apps/llm-gateway`。

## 2. 重要边界

- 只代理官方 provider API Key。
- 不代理 Codex Plus / Pro、ChatGPT Plus / Pro、网页登录态或 Cookie。
- Codex 额度只通过后台链接跳转到 `https://chatgpt.com/codex/settings/usage` 查看。
- 当前 bootstrap runtime 需要配置 `LLM_GATEWAY_BOOTSTRAP_API_KEY`，否则 `/v1/*` 路由会 fail closed。

## 3. Vercel 部署

在 Vercel 中导入当前仓库，Root Directory 选择 `apps/llm-gateway`。配置数据库、Redis、provider key、session secret 和 key hashing secret 后，再逐步替换当前内存 bootstrap runtime。

`/v1/*` 由 `vercel.json` rewrite 到 `/api/v1/*`，因此 OpenAI-compatible 客户端只需要配置：

```text
base_url=https://<your-domain>/v1
api_key=<LLM_GATEWAY_BOOTSTRAP_API_KEY 或后续后台创建的虚拟 Key>
```

## 4. 本地验证

运行：

```bash
pnpm --dir apps/llm-gateway typecheck
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test
pnpm --dir apps/llm-gateway build
```
