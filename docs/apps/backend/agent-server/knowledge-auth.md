# agent-server Knowledge Auth Stub

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/knowledge`
对应接口规范：`docs/contracts/api/knowledge.md`
最后核对：2026-05-01

## 目标

`KnowledgeModule` 提供 Knowledge 前端所需的认证入口。memory 模式仍保留横向 MVP stub；当 `DATABASE_URL` 存在或显式 `KNOWLEDGE_REPOSITORY=postgres` 时，登录会读取数据库中的超管账号并创建 Knowledge 自己的 JWT 双 token 与 refresh session。

## 当前入口

源码入口：

```text
apps/backend/agent-server/src/knowledge/
  knowledge.module.ts
  knowledge.controller.ts
  knowledge.service.ts
  knowledge-auth.service.ts
  knowledge-admin-authenticator.ts
```

模块装配：

- `apps/backend/agent-server/src/app/app.module.ts` 引入 `KnowledgeModule`。
- controller 路由前缀是 `knowledge/v1`，认证方法挂在 `auth/*`；全局 API prefix 由后端宿主统一处理。
- 该模块遵守后端结构检查的标准布局：`knowledge.module.ts`、`knowledge.controller.ts`、`knowledge.service.ts` 与服务测试位于模块根或 `test/knowledge/`。

## 当前行为

- `POST /knowledge/v1/auth/login`
  - 接受历史字段 `email` 和 `password`；postgres 模式下 `email` 按账号名解释。
  - 空账号或空密码返回 `auth_invalid_credentials`。
  - memory 模式保留 stub 用户摘要，用于无数据库的本地 demo。
  - postgres 模式通过 `PostgresKnowledgeAdminAuthenticator` 校验数据库超管账号，成功后映射为 Knowledge `owner` 用户并返回双 token。
- `POST /knowledge/v1/auth/refresh`
  - 接受 Knowledge refresh token。
  - 成功后 rotation refresh token，并将旧 refresh token session 置为 revoked / rotated。
  - 无法解析、已轮转、已撤销或已过期时返回 refresh token 错误。
- `GET /knowledge/v1/auth/me`
  - 校验 Bearer access token 和服务端 session 状态。
  - postgres 模式会按 token 中的用户 id 回读超管账号，仍只暴露 Knowledge 用户投影。
- `POST /knowledge/v1/auth/logout`
  - 返回 `{ ok: true }`。
  - 若请求体携带有效 refresh token，会撤销对应 Knowledge refresh session；前端退出登录仍会删除本地 token。

## 后续替换边界

后续进入纵向生产化时，保持 Knowledge API contract 不变，继续增强 service 内部实现：

- 将历史请求字段 `email` 迁移为更准确的 `username` / `account` contract，并保留兼容解析。
- 用户、workspace、roles、permissions 进一步收敛到统一账号 / workspace repository。
- controller 保持薄，不直接签 token、不直接查库。
