# 模板示例

状态：current
适用范围：项目模板与结构示例
最后核对：2026-04-14

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

## 5. 仓库级代理 Skill 模板

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
- 运行时 skill registry 仍放在 `packages/skills`
