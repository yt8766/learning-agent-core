import fs from 'node:fs';

const summaryPath = 'artifacts/coverage/vitest/coverage-summary.json';
const scopes = [
  'packages/runtime/src/',
  'apps/backend/agent-server/src/',
  'apps/frontend/agent-chat/src/',
  'apps/frontend/agent-admin/src/',
  'apps/frontend/knowledge/src/',
  'packages/tools/src/',
  'packages/skill/src/',
  'packages/templates/src/',
  'agents/audio/src/',
  'agents/video/src/'
];

if (!fs.existsSync(summaryPath)) {
  console.error(`[coverage-gaps] missing ${summaryPath}; run pnpm test:coverage first`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const rows = Object.entries(summary)
  .filter(([filePath]) => filePath !== 'total')
  .map(([filePath, metrics]) => ({
    filePath,
    lines: metrics.lines.pct,
    statements: metrics.statements.pct,
    functions: metrics.functions.pct,
    branches: metrics.branches.pct,
    score: metrics.lines.pct + metrics.statements.pct + metrics.functions.pct + metrics.branches.pct
  }));

console.log('[coverage-gaps] total', JSON.stringify(summary.total));

for (const scope of scopes) {
  const scopeRows = rows
    .filter(row => row.filePath.includes(scope))
    .filter(row => row.lines < 85 || row.statements < 85 || row.functions < 85 || row.branches < 85)
    .sort((left, right) => left.score - right.score)
    .slice(0, 20);

  if (scopeRows.length === 0) continue;

  console.log(`\n## ${scope}`);
  for (const row of scopeRows) {
    console.log(
      [
        row.lines.toFixed(2),
        row.statements.toFixed(2),
        row.functions.toFixed(2),
        row.branches.toFixed(2),
        row.filePath
      ].join('\t')
    );
  }
}
