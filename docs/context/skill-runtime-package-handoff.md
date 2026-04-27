# skill-runtime 包交接文档

状态：current
文档类型：guide
适用范围：`packages/skill-runtime`
最后核对：2026-04-19

## 包定位

`packages/skill-runtime` 是运行时 skill catalog、registry、source sync、install 与 lifecycle policy 的真实宿主。

## 当前主要目录

- `src/catalog/`
- `src/registry/`
- `src/sources/`
- `src/install/`
- `src/policies/`
- `src/contracts/`

## 修改前先读

- [docs/packages/skill-runtime/README.md](/docs/packages/skill-runtime/README.md)
- [docs/packages/skill-runtime/package-structure-guidelines.md](/docs/packages/skill-runtime/package-structure-guidelines.md)
- [docs/skills/runtime-skills-vs-repo-skills.md](/docs/skills/runtime-skills-vs-repo-skills.md)

## 改动边界

- 这里负责运行时技能，不负责仓库代理技能 `.agents/skills/*`。
- source、install、policy 的规则应继续集中在这里，不要重新散到 backend service 或 runtime helper。
- 涉及 install / approve / reject 流程时，注意治理语义与审批门一致性。

## 验证

- `pnpm exec tsc -p packages/skill-runtime/tsconfig.json --noEmit`
- `pnpm --dir packages/skill-runtime test`
- `pnpm --dir packages/skill-runtime test:integration`

## 交接提醒

- “运行时技能”和“代理技能”是两套概念，修改时不要混用目录与文档。
