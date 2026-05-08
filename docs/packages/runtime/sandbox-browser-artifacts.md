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

## 默认 artifact storage

未注入 `browserArtifactWriter` 时，`executeBrowsePage(...)` 会写入显式 artifact storage：

- `artifacts/runtime/browser-replays/<sessionId>/snapshot.html`
- `artifacts/runtime/browser-replays/<sessionId>/screenshot.txt`
- `artifacts/runtime/browser-replays/<sessionId>/replay.json`

返回给调用方的 `snapshotRef`、`screenshotRef` 与 `artifactRef` 保持为上述 artifact 相对引用，不暴露本机绝对路径。新增调用方若需要持久化、下载、审计或跨机器访问，仍应在 runtime/backend 装配层注入真实 `BrowserReplayArtifactWriter`，不要读取 root `data/browser-replays`。

`LocalSandboxExecutor.write_data_report_bundle` 的默认写入根目录同样使用显式 artifact storage：`artifacts/report-kit/data-report-output`。调用方如果要写入真实业务项目源码，必须显式传入 `targetRoot`，不能依赖默认 root `data/generated` 路径。
