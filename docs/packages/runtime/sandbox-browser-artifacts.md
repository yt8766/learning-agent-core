# Sandbox Browser Artifacts

状态：current
文档类型：reference
适用范围：`packages/runtime/src/sandbox/*`
最后核对：2026-05-08

`browse_page` 当前仍是本地 sandbox 的模拟浏览器工具。它会生成三类 browser artifact：

- `browser_snapshot`：`snapshot.html`
- `browser_screenshot`：`screenshot.txt`
- `browser_replay`：`replay.json`

## 当前写入边界

`LocalSandboxExecutor` 支持通过构造参数注入 `browserArtifactWriter`：

```ts
new LocalSandboxExecutor({
  browserArtifactWriter,
  now,
  browserSessionIdFactory
});
```

`browserArtifactWriter.writeReplayArtifact(...)` 是 browser replay/generated artifact 的稳定写入 seam。注入后，runtime 只消费 writer 返回的 `artifactId` 与 `artifactUrl`，并把这些稳定引用写入：

- `rawOutput.artifactId`
- `rawOutput.artifactUrl`
- `rawOutput.artifactRef`
- `rawOutput.snapshotRef`
- `rawOutput.screenshotRef`
- replay JSON 内的 `snapshotRef`、`screenshotRef` 与 step `artifactRef`

注入 writer 的路径不得写入仓库根目录 `data/browser-replays/*`。这条行为由 `packages/runtime/test/sandbox-executor-browser-artifacts.test.ts` 覆盖。

## 过渡 fallback

未注入 `browserArtifactWriter` 时，`executeBrowsePage(...)` 会继续写入 `data/browser-replays/<sessionId>/`。这是兼容旧调用方的过渡态 fallback，不是新增调用方应该依赖的 artifact repository。

后续接入真实 artifact repository 时，应优先在 runtime/backend 装配层提供 `BrowserReplayArtifactWriter`，不要让业务调用方直接读取 root `data/browser-replays`。
