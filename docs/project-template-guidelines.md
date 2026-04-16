# 模板示例

状态：current
文档类型：template
适用范围：项目模板与结构示例
最后核对：2026-04-16

## 1. 后端模块模板

### `chat.module.ts`

```ts
import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule {}
```

### `chat.controller.ts`

```ts
import { Body, Controller, Get, Post } from '@nestjs/common';

import { ChatService } from './chat.service';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';

@Controller('chat/sessions')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  listSessions() {
    return this.chatService.listSessions();
  }

  @Post()
  createSession(@Body() dto: CreateChatSessionDto) {
    return this.chatService.createSession(dto);
  }
}
```

### `chat.service.ts`

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
  listSessions() {
    return [];
  }

  createSession(dto: { message: string }) {
    return dto;
  }
}
```

### `create-chat-session.dto.ts`

```ts
export class CreateChatSessionDto {
  title?: string;
  message!: string;
}
```

## 2. 前端页面模板

### `src/app/app.tsx`

```tsx
import { ChatHomePage } from '../pages/chat-home/chat-home-page';

export default function App() {
  return <ChatHomePage />;
}
```

### `src/pages/chat-home/chat-home-page.tsx`

```tsx
import { useEffect, useState } from 'react';

import { listSessions } from '../../api/chat-api';
import type { ChatSession } from '../../types/chat';

export function ChatHomePage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listSessions()
      .then(data => {
        if (active) {
          setSessions(data);
        }
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>{error}</div>;

  return <section>{sessions.length}</section>;
}
```

## 3. `agent-core` 内部分层模板

### 目录结构

```text
src/
├─ adapters/
├─ flows/
│  ├─ approval/
│  ├─ chat/
│  ├─ data-report/
│  ├─ delivery/
│  ├─ learning/
│  ├─ ministries/
│  ├─ route/
│  └─ supervisor/
├─ graphs/
├─ runtime/
├─ session/
├─ shared/
├─ types/
├─ utils/
└─ workflows/
```

### 说明

当前项目不再使用早期 `models / agents / graph` 这类目录模板，而是按：

- `graphs`
  - graph 入口、状态定义、边编排
- `flows`
  - 节点实现、prompt、schema、局部 helper
- `runtime`
  - 运行时装配与主链 facade
- `session`
  - 会话驱动与 checkpoint / recover 桥接
- `shared`
  - 共享 prompt、schema、contract
- `workflows`
  - workflow 路由、预设、轻量契约

### `graphs/<domain>.graph.ts`

```ts
export function createExampleGraph() {
  return 'graph-entry';
}
```

### `flows/<domain>/nodes/example-node.ts`

```ts
export function runExampleNode(input: string) {
  return { output: input };
}
```

### `runtime/example-runtime-facade.ts`

```ts
export class ExampleRuntimeFacade {
  run(task: string) {
    return task;
  }
}
```

### `session/example-session-coordinator.ts`

```ts
export class ExampleSessionCoordinator {
  attach(sessionId: string) {
    return sessionId;
  }
}
```

## 4. package 模板

### `src/index.ts`

```ts
export * from './types';
export * from './service';
```

### `package.json`

```json
{
  "name": "@agent/example",
  "version": "0.1.0",
  "main": "build/cjs/index.js",
  "module": "build/esm/index.mjs",
  "types": "build/types/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types": "./build/types/index.d.ts",
        "default": "./build/esm/index.mjs"
      },
      "require": {
        "types": "./build/types/index.d.ts",
        "default": "./build/cjs/index.js"
      }
    }
  }
}
```

### `tsconfig.types.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "build/types",
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationMap": true,
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["src/**/*"],
  "exclude": ["build", "dist", "node_modules", "**/*.spec.ts"]
}
```

### `tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  sourcemap: true,
  clean: true
});
```

## 5. 验证脚手架模板

项目生成规范默认必须同时考虑以下 5 类验证能力，并与仓库现有 `test/` 目录、`Vitest`、`zod`、`TypeScript` 约束保持一致：

- `Type`：类型检查
- `Spec`：`zod` 结构校验
- `Unit Test`：原子逻辑单测
- `Demo`：最小可运行闭环
- `Integration`：跨模块或跨包协同验证

推荐包级结构：

```text
packages/<domain>/
├─ src/
│  ├─ index.ts
│  └─ schemas/
├─ test/
│  ├─ <domain>.test.ts
│  └─ <domain>.int-spec.ts
├─ package.json
├─ tsconfig.json
├─ tsconfig.types.json
└─ tsup.config.ts
```

说明：

- `test/` 是当前仓库唯一推荐测试入口，不使用 `__tests__/`
- 当前不再要求 `packages/*` 维护与 `src/` 同级的 `demo/`
- 如果宿主不维护独立 `demo/`，则必须至少补一条自动化“最小闭环验证”，例如 integration test 或 build 验证
- 稳定结构化 contract 默认放到 `src/schemas/` 或贴近领域模块放置，不允许只靠 `JSON.parse` + 手写判断

### `src/schemas/example.schema.ts`

```ts
import { z } from 'zod';

export const ExampleInputSchema = z.object({
  taskId: z.string().min(1),
  mode: z.enum(['plan', 'execute'])
});

export type ExampleInput = z.infer<typeof ExampleInputSchema>;
```

### `test/example.test.ts`

```ts
import { describe, expect, it } from 'vitest';

import { ExampleInputSchema } from '../src/schemas/example.schema';

describe('ExampleInputSchema', () => {
  it('accepts valid structured input', () => {
    expect(
      ExampleInputSchema.parse({
        taskId: 'task-1',
        mode: 'execute'
      })
    ).toEqual({
      taskId: 'task-1',
      mode: 'execute'
    });
  });

  it('rejects invalid mode values', () => {
    expect(() =>
      ExampleInputSchema.parse({
        taskId: 'task-1',
        mode: 'invalid'
      })
    ).toThrow();
  });
});
```

### `test/example.int-spec.ts`

```ts
import { describe, expect, it } from 'vitest';

import { runExampleNode } from '../src/flows/example/nodes/example-node';

describe('example integration', () => {
  it('runs the minimal happy path', async () => {
    await expect(runExampleNode('task-1')).resolves.toEqual({
      output: 'task-1'
    });
  });
});
```

### `package.json`

```json
{
  "scripts": {
    "build:lib": "tsup",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test:spec": "node ../../scripts/run-spec-tests.js packages/<domain>",
    "test": "vitest run --config ../../vitest.config.js test/example.test.ts",
    "test:integration": "node ../../scripts/run-package-integration-tests.js packages/<domain>"
  }
}
```

说明：

- 包级 `test:integration` 不再手写脆弱 glob；统一复用仓库脚本按当前包 `test/` 目录枚举 `*.int-spec.*`
- 如果包内暂时没有 integration 用例，脚本应平稳退出，后续在跨包协作出现时再补齐

生成与验收要求：

- 新生成包至少要有 1 条 `Type` 验证路径，默认接入根级 `pnpm typecheck`
- 只要有稳定结构化输入输出，就必须补 `Spec` schema 与 parse 测试
- 核心逻辑必须补 `Unit Test`
- `packages/*` 默认补 `Demo`；当前优先通过 integration、build 或其他自动化 smoke 提供等价最小闭环验证
- 触达跨包协作、graph、SSE、审批恢复、前后端联动时，必须补 `Integration`

## 6. 通用脚手架 Phase 1

当前通用生成链路默认由 `@agent/tools` 的 scaffold 能力承载，第一阶段只覆盖 `packages/*` 与 `agents/*`。

固定模板：

- `package-lib`
  - 输出 `src/index.ts`、`src/schemas/<domain>.schema.ts`、`test/*.test.ts`、`test/*.int-spec.ts`、`package.json`、`tsconfig*.json`、`tsup.config.ts`、`README.md`
- `agent-basic`
  - 输出 `src/index.ts`、`src/graphs/<domain>.graph.ts`、`src/flows/<domain>/schemas/*`、`src/flows/<domain>/prompts/*`、`test/*.test.ts`、`test/*.int-spec.ts`、`package.json`、`tsconfig*.json`、`tsup.config.ts`、`README.md`

固定规则：

- `package-lib` 默认生成 `Type + Spec + Unit + Integration`
- `agent-basic` 默认生成 `Type + Spec + Unit + Integration`
- 两类模板都必须带 `typecheck`、`test:spec`、`test`、`test:integration`、`verify` 脚本
- `name` 统一使用 kebab-case，并派生 PascalCase / camelCase 导出名

实现补充：

- `package-lib` 会额外生成 `src/package.json`
- 这个文件只用于让模板源码中的 `.ts` 入口稳定按 ESM 处理，不改变包根 `package.json` 的对外导出语义
- 生成 `tsconfig.json` 时，`zod` 的 `paths` 会优先落到仓库内稳定的 workspace `node_modules/zod` 入口，避免把 `.pnpm/zod@具体版本/...` 这类实现细节写死进生成结果

当前建议 API：

```ts
import { buildAgentScaffold, buildPackageScaffold, writeScaffoldBundle } from '@agent/tools';

const bundle = await buildPackageScaffold({
  name: 'example-lib',
  mode: 'preview'
});

await writeScaffoldBundle({
  bundle,
  targetRoot: '/abs/path/to/packages/example-lib'
});
```

根级约束：

- `packages/templates` 继续只承载模板资产与 registry
- `packages/tools/src/scaffold` 承载 preview / write 逻辑
- 根级 `pnpm typecheck` 现已动态发现 `packages/*/tsconfig.json` 与 `agents/*/tsconfig.json`
- 新生成包只要落位到 `packages/*` 或 `agents/*`，默认会进入根级类型检查
- Phase 1 的默认验收以模板测试、`packages/tools` 内 scaffold 写出烟测与 integration 为准，不要求仓库内长期保留已生成参考包

## 7. 仓库级代理 Skill 模板

```text
skills/
└─ code-review/
   ├─ SKILL.md
   ├─ references/
   ├─ scripts/
   └─ assets/
```

说明：

- `SKILL.md` 是代理技能入口
- `references/` 放规范和样例
- `scripts/` 放代理可执行脚本
- `assets/` 放模板或静态资源
- 运行时 skill registry 的真实宿主位于 `packages/skill-runtime`
