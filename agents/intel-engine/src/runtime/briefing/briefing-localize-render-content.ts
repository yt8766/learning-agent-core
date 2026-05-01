import type { TechBriefingCategory, TechBriefingItem } from './briefing.types';
export { buildImpactNote, buildActionNote, itemTypeLabel } from './briefing-category-rules';
import { buildActionNote } from './briefing-category-rules';

export function buildCoreChange(category: TechBriefingCategory) {
  if (category === 'frontend-security')
    return '涉及安全公告、供应链事件或漏洞记录，需关注依赖命中、受影响版本与修复窗口。';
  if (category === 'devtool-security')
    return '涉及代码代理、IDE 插件、workspace trust、源码暴露或开发工具安全事件，需关注本地环境、权限和凭证风险。';
  if (category === 'ai-tech') return '涉及模型、API、SDK、Agent 或推理工程能力更新，适合评估接入价值与平台影响。';
  return '涉及框架、浏览器平台、构建工具或部署适配能力更新，适合评估升级和规范变更。';
}

export function describeStackRelevance(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matched = [
    'react',
    'vite',
    'next',
    'vue',
    'typescript',
    'axios',
    'apifox',
    'node.js',
    'nodejs',
    'chrome',
    'v8',
    'webassembly',
    'wasm',
    'npm',
    'pnpm',
    'claude code',
    'mcp',
    'langgraph',
    'langsmith',
    'hugging face',
    'spaces',
    'bun',
    'deno',
    'go',
    'rust',
    'java',
    'spring',
    'kubernetes',
    'docker',
    'terraform',
    'serverless',
    'github actions',
    'gitlab ci',
    'postgres',
    'redis',
    'linux',
    'windows',
    'macos',
    'aws'
  ].filter(keyword => text.includes(keyword));
  if (matched.length >= 2) return { level: '高' as const, note: `高度相关（命中 ${matched.join(' / ')}）` };
  if (matched.length === 1) return { level: '中' as const, note: `中度相关（命中 ${matched[0]}）` };
  return { level: '低' as const, note: '低相关（未直接命中当前核心栈关键词）' };
}

export function actionChecklist(category: TechBriefingCategory, item: TechBriefingItem) {
  if (item.actionSteps) {
    return [
      `排查：${item.actionSteps.triage.join('；')}`,
      `修复：${item.actionSteps.fix.join('；')}`,
      `验证：${item.actionSteps.verify.join('；')}`
    ];
  }
  const note = buildActionNote(category, item)
    .replace(/排查是否中招：/g, '')
    .replace(/处理建议：/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (category === 'frontend-security' && /axios/i.test(`${item.title} ${item.summary}`))
    return [
      '执行 `pnpm why axios` 或 `npm ls axios` 检查命中版本',
      '升级到官方修复版本',
      '轮换可能暴露的 Token 或凭证'
    ];
  if (category === 'frontend-security' && /apifox/i.test(`${item.title} ${item.summary}`))
    return ['确认最近一周是否加载过受影响 Apifox 资源', '清理缓存并轮换密钥或 Token', '按官方公告完成升级与排查'];
  if (category === 'devtool-security' && /claude code/i.test(`${item.title} ${item.summary}`))
    return ['确认团队是否安装受影响版本', '清理本地缓存和日志', '升级到修复版本并复核 workspace trust'];
  return note
    .split(/[。；]/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function buildCategorySections(category: TechBriefingCategory, items: TechBriefingItem[]) {
  if (category === 'ai-tech') {
    const modelItems = items.filter(item =>
      /\b(gemini|claude|gpt|qwen|glm|phi|nemotron|model|reasoning|audio|voice|multimodal)\b/i.test(
        `${item.title} ${item.summary}`
      )
    );
    const platformItems = items.filter(
      item =>
        !modelItems.includes(item) &&
        /\b(langchain|langgraph|middleware|framework|platform|sdk|api|runtime|agent|workflow|memory)\b/i.test(
          `${item.title} ${item.summary}`
        )
    );
    const benchmarkItems = items.filter(
      item =>
        !modelItems.includes(item) &&
        !platformItems.includes(item) &&
        /\b(benchmark|swe-bench|eval|ranking)\b/i.test(`${item.title} ${item.summary}`)
    );
    const otherItems = items.filter(
      item => !modelItems.includes(item) && !platformItems.includes(item) && !benchmarkItems.includes(item)
    );
    return [
      { label: modelItems.length > 0 ? '核心模型演进与发布' : '', items: modelItems },
      { label: benchmarkItems.length > 0 ? '模型评测与风向' : '', items: benchmarkItems },
      { label: platformItems.length > 0 ? '框架、工具与平台' : '', items: platformItems },
      { label: otherItems.length > 0 ? '其他更新' : '', items: otherItems }
    ];
  }
  if (category === 'backend-tech') {
    const runtimeItems = items.filter(item => /\b(node\.js|nodejs|bun|deno)\b/i.test(`${item.title} ${item.summary}`));
    const languageItems = items.filter(
      item =>
        !runtimeItems.includes(item) && /\b(go|rust|java|spring|dotnet|\.net)\b/i.test(`${item.title} ${item.summary}`)
    );
    const otherItems = items.filter(item => !runtimeItems.includes(item) && !languageItems.includes(item));
    return [
      { label: runtimeItems.length > 0 ? '运行时与平台' : '', items: runtimeItems },
      { label: languageItems.length > 0 ? '语言与框架' : '', items: languageItems },
      { label: otherItems.length > 0 ? '其他更新' : '', items: otherItems }
    ];
  }
  if (category === 'cloud-infra-tech') {
    const infraItems = items.filter(item => /\b(kubernetes|docker|terraform)\b/i.test(`${item.title} ${item.summary}`));
    const deliveryItems = items.filter(
      item =>
        !infraItems.includes(item) &&
        /\b(github actions|gitlab ci|ci\/cd|cicd)\b/i.test(`${item.title} ${item.summary}`)
    );
    const edgeItems = items.filter(
      item =>
        !infraItems.includes(item) &&
        !deliveryItems.includes(item) &&
        /\b(serverless|edge|cloudflare|vercel|aws)\b/i.test(`${item.title} ${item.summary}`)
    );
    const otherItems = items.filter(
      item => !infraItems.includes(item) && !deliveryItems.includes(item) && !edgeItems.includes(item)
    );
    return [
      { label: infraItems.length > 0 ? '编排与基础设施' : '', items: infraItems },
      { label: deliveryItems.length > 0 ? 'CI/CD 与交付' : '', items: deliveryItems },
      { label: edgeItems.length > 0 ? '边缘与 Serverless' : '', items: edgeItems },
      { label: otherItems.length > 0 ? '其他更新' : '', items: otherItems }
    ];
  }
  if (category === 'general-security') return [{ label: '高危通告', items }];
  if (category !== 'frontend-tech') return [{ label: '', items }];
  const primaryItems = items.filter(item => item.sourceGroup === 'official');
  const supplementalItems = items.filter(item => item.sourceGroup !== 'official');
  return [
    { label: primaryItems.length > 0 ? '主更新' : '', items: primaryItems },
    { label: supplementalItems.length > 0 ? '补充观察' : '', items: supplementalItems }
  ];
}

export function inferSecurityCheckCommand(category: TechBriefingCategory, item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/\blinux|kernel\b/.test(text))
    return 'uname -r\njournalctl -k --since "7 days ago" | rg -i "panic|segfault|exploit|cve"';
  if (/\bnode\.js|nodejs\b/.test(text))
    return 'node -v\nrg -n "FROM node:|nodejs" Dockerfile* .github package.json pnpm-lock.yaml';
  if (/\bpostgres|postgresql\b/.test(text)) return 'psql --version\npsql -Atqc "select version();"';
  if (/\bredis\b/.test(text)) return 'redis-server --version\nredis-cli INFO server | rg redis_version';
  if (/\bkubernetes\b/.test(text)) return 'kubectl version --short\nkubectl get nodes -o wide';
  if (/\bdocker\b/.test(text)) return 'docker version\ndocker info';
  if (/\bwindows\b/.test(text)) return 'systeminfo | findstr /B /C:"OS Name" /C:"OS Version"';
  if (/\bmacos|apple\b/.test(text)) return 'sw_vers\nsystem_profiler SPSoftwareDataType';
  if (category === 'devtool-security' && /\bclaude code\b/.test(text))
    return 'claude --version\nrg -n "claude|workspace trust|mcp" ~/.config .';
  if (category === 'devtool-security' && /\bmcp\b/.test(text))
    return 'rg -n "mcp|Model Context Protocol|path.resolve|../" .';
  return undefined;
}

export function extractCheckCommand(item: TechBriefingItem) {
  const steps = item.actionSteps?.triage ?? [];
  const matched = steps.join(' ').match(/`([^`]+)`/);
  return matched?.[1];
}

export function appendCommandInstructions(lines: string[], commandBlock: string) {
  const instructions = splitCommandInstructions(commandBlock);
  instructions.forEach(({ description, command }) => {
    lines.push(description);
    lines.push('```bash');
    lines.push(command);
    lines.push('```');
  });
}

export function buildCommandMarkdown(commandBlock: string) {
  const instructions = splitCommandInstructions(commandBlock);
  return [
    '**检查命令**',
    ...instructions.flatMap(({ description, command }) => [description, '```bash', command, '```'])
  ].join('\n');
}

function splitCommandInstructions(commandBlock: string) {
  return commandBlock
    .split('\n')
    .map(command => command.trim())
    .filter(Boolean)
    .map(command => ({ description: describeCheckCommand(command), command }));
}

function describeCheckCommand(command: string) {
  const normalized = command.toLowerCase();
  if (/\bclaude\s+--version\b/.test(normalized)) return '检查本机 Claude Code 版本：';
  if (/\brg\b/.test(normalized) && /\bworkspace trust|mcp|claude\b/.test(normalized))
    return '搜索本地配置与当前目录里是否出现相关配置项：';
  if (/\bpnpm why\b|\bnpm ls\b/.test(normalized)) return '确认当前项目是否实际引入受影响依赖：';
  if (/\bkubectl version\b/.test(normalized)) return '检查 Kubernetes 客户端与集群版本：';
  if (/\bkubectl get nodes\b/.test(normalized)) return '确认集群节点范围与当前运行环境：';
  if (/\bdocker version\b/.test(normalized)) return '检查 Docker 客户端与服务端版本：';
  if (/\bdocker info\b/.test(normalized)) return '确认 Docker 运行时与守护进程状态：';
  if (/\buname -r\b/.test(normalized)) return '检查当前内核版本：';
  if (/\bsw_vers\b|\bsystem_profiler\b/.test(normalized)) return '检查当前 macOS 系统版本：';
  if (/\bsysteminfo\b/.test(normalized)) return '检查当前 Windows 系统版本：';
  if (/\bredis-server --version\b|\bredis-cli\b/.test(normalized)) return '检查 Redis 版本与服务端信息：';
  if (/\bnode\b.*--version|\bnode -v\b/.test(normalized)) return '检查当前 Node.js 版本：';
  return '执行以下排查命令：';
}
