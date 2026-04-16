import type { TechBriefingCategory, TechBriefingItem } from './runtime-tech-briefing.types';

export function buildImpactNote(category: TechBriefingCategory, item: TechBriefingItem) {
  if (item.whyItMatters) return item.whyItMatters;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (category === 'frontend-security') {
    if (/\b(node\.js|nodejs|tls|hashdos|bff|ssr)\b/.test(text))
      return '这类事件会直接影响 Node.js SSR、BFF 网关和前端基础镜像的稳定性，若线上仍运行受影响版本，可能被异常握手或构造负载直接打崩。';
    if (/\b(chrome|webgl|webcodecs|use-after-free|browser)\b/.test(text))
      return '这类事件会直接影响浏览器客户端运行时安全，若业务依赖复杂渲染、媒体能力或富交互，需尽快确认客户端升级窗口。';
    if (/\b(v8|webassembly|wasm)\b/.test(text))
      return '这类事件会影响浏览器与 Node.js 共用运行时，若业务依赖复杂 WASM 模块，需尽快确认沙箱边界与客户端更新节奏。';
    return '这类事件会直接影响依赖供应链、调试工具或 CDN 前端资源，若命中 axios、Apifox、npm/pnpm 相关链路，应立即确认受影响版本与暴露面。';
  }
  if (category === 'devtool-security') {
    if (/\b(mcp|cursor|windsurf|path traversal|uri)\b/.test(text))
      return '这类事件会直接影响本地工具链、MCP Server 与 IDE 代理边界，若缺少根目录白名单和路径清洗，可能被恶意 Prompt 越权读取本地敏感文件。';
    if (/\b(langgraph|checkpointer|sqlite|postgres|memory|deserialize)\b/.test(text))
      return '这类事件会直接影响 Agent 长期记忆与状态持久化层，若对历史状态重放或反序列化处理不严，可能导致 DoS 或状态污染。';
    if (/\b(hugging face|spaces|gradio|env|environment)\b/.test(text))
      return '这类事件会直接影响公开演示环境和托管 Agent Demo 的凭证边界，若环境变量暴露，可能导致云端密钥和内部配置泄露。';
    if (/\b(langsmith|permission|rbac|project)\b/.test(text))
      return '这类事件会影响云端调试台、项目权限和团队可见范围，适合尽快核查访问日志与最小权限配置。';
    return '这类事件会直接影响代码代理、IDE 插件、workspace trust、本地源码和凭证安全，适合尽快确认团队工具版本与暴露面。';
  }
  if (category === 'general-security')
    return '这类事件会直接影响基础设施稳定性、权限边界或数据库/云平台暴露面，若线上仍运行受影响版本，应尽快核查版本、入口条件与补丁窗口。';
  if (category === 'ai-tech') {
    if (/\b(gemini|claude|gpt|qwen|glm|phi|nemotron|model|reasoning|audio|voice|multimodal)\b/.test(text))
      return '这类变化会直接影响模型选型、复杂推理链路、多模态交互架构和实时语音能力，适合尽快判断是否要进入评测或替换路线。';
    if (/\b(langchain|langgraph|middleware|sdk|runtime|agent|workflow|memory)\b/.test(text))
      return '这类变化会影响 Agent 的编排方式、可观测性、权限切面与运行时扩展能力，适合纳入服务端工程化评估。';
    if (/\b(benchmark|swe-bench|eval|ranking)\b/.test(text))
      return '这类变化会直接影响模型选型和平台路线判断，适合和现有基准、成本与推理稳定性一起综合评估。';
    return '这类更新可能改变模型选型、推理链路、Agent 编排方式或 SDK 接入成本，适合尽快判断是否值得做 PoC。';
  }
  if (category === 'backend-tech')
    return '这类变化会影响服务端运行时、语言版本、框架迁移或构建链路，适合尽快判断是否需要更新模板、镜像和现网升级计划。';
  if (category === 'cloud-infra-tech')
    return '这类变化会影响部署编排、CI/CD、边缘与可观测性基建，适合纳入平台侧发布、回滚和运维治理评估。';
  if (/\b(eslint|flat config|monorepo|lint)\b/.test(text))
    return '这类变化会直接影响脚手架模板、Lint 规范和 Monorepo 工具链兼容性，升级不当可能导致现有配置直接失效。';
  if (/\b(astro|vite|environment api|ssr|hydration)\b/.test(text))
    return '这类变化会影响开发态与生产态的一致性、SSR 行为和插件兼容边界，适合纳入框架升级与构建验证。';
  if (/\b(css|light-dark|prefers-color-scheme|images?)\b/.test(text))
    return '这类变化会影响组件库、主题系统和静态资源切换方式，适合在设计系统和 UI 基建中试点验证。';
  if (/react|vite|vue|next|typescript/i.test(text))
    return '这类变化通常会影响脚手架、构建链路、框架升级窗口或团队规范，适合纳入前端工程评估。';
  return '建议结合当前前端技术栈和工程规范评估是否要跟进验证或纳入升级计划。';
}

export function buildActionNote(category: TechBriefingCategory, item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (category === 'frontend-security') {
    if (text.includes('axios'))
      return '排查是否中招：执行 `pnpm why axios` 或 `npm ls axios`，确认生产依赖与锁文件中的 axios 版本；同时检查网关/SSR/Node 服务是否会处理不受信任的大体积响应或请求数据。 处理建议：优先升级到官方修复版本；若暂时无法升级，先在代理层、网关层或应用层增加响应体/请求体大小限制、超时与熔断保护，并安排回归测试。';
    if (text.includes('apifox'))
      return '排查是否中招：确认最近一周是否加载过 Apifox 控制台/CDN 前端资源，核查浏览器缓存、调试机访问记录和相关凭证是否暴露。 处理建议：立即清理缓存、轮换可能暴露的 Token/Cookie/密钥，按官方公告升级或切换到已确认安全的资源版本，并补充终端侧木马/异常脚本排查。';
    if (/\b(node\.js|nodejs|tls|hashdos|bff|ssr)\b/.test(text))
      return '排查是否中招：确认生产 Node.js 基础镜像、SSR 服务与 BFF 网关版本是否落在受影响范围。 处理建议：优先升级到官方修复版本，并安排握手异常、JSON 大负载与 CPU 飙高场景回归验证。';
    if (/\b(chrome|webgl|webcodecs|use-after-free|browser)\b/.test(text))
      return '排查是否中招：确认团队浏览器基线版本，特别是依赖 WebGL、WebCodecs 或富渲染能力的机器与测试环境。 处理建议：尽快推进浏览器升级，并对高风险客户端场景补做稳定性与崩溃回归验证。';
    if (/\b(v8|webassembly|wasm)\b/.test(text))
      return '排查是否中招：确认业务是否依赖 WebAssembly 或复杂浏览器计算模块，并核对浏览器/V8 版本。 处理建议：优先升级到修复版本，对关键 WASM 流程补做边界输入、崩溃与沙箱回归测试。';
    if (text.includes('claude code'))
      return '排查是否中招：确认团队是否安装受影响版本，并检查仓库信任配置、工作区配置和日志中是否出现敏感路径、Token 或源码片段泄露。 处理建议：升级到修复版本，清理本地缓存与日志，轮换可疑凭证，并复查受影响机器上的信任配置。';
    return '排查是否中招：先用 `pnpm why <package>`、`npm ls <package>` 或锁文件搜索确认是否命中直接/间接依赖，再核查最近 7 天是否加载相关 CDN、脚本或开发工具。 处理建议：优先升级到官方修复版本，必要时临时锁版本、禁用相关能力、轮换凭证，并补做构建链路与生产流量回归验证。';
  }
  if (category === 'devtool-security') {
    if (/\b(mcp|cursor|windsurf|path traversal|uri)\b/.test(text))
      return '排查是否中招：审查团队内部自研 MCP Server 是否直接把用户输入拼进文件或资源 URI，确认是否存在路径穿越和任意文件读取风险。 处理建议：统一引入 `path.resolve()`、根目录白名单和资源类型校验，阻断 `../`、绝对路径与越权文件访问。';
    if (/\b(langgraph|checkpointer|sqlite|postgres|memory|deserialize)\b/.test(text))
      return '排查是否中招：检查 LangGraph Checkpointer 是否直接持久化未经清洗的原始用户输入或异常长状态片段。 处理建议：升级到最新补丁版本，并为状态持久化层补充长度限制、序列化校验与重放保护。';
    if (/\b(hugging face|spaces|gradio|env|environment)\b/.test(text))
      return '排查是否中招：检查公开 Hugging Face Spaces、Gradio Demo 或内部演示环境是否暴露环境变量、调试信息或系统配置。 处理建议：轮换可疑密钥，收紧公开访问范围，并把敏感变量迁移到更严格的密钥管理通道。';
    if (/\b(langsmith|permission|rbac|project)\b/.test(text))
      return '排查是否中招：检查 LangSmith 项目权限、团队成员可见范围和近期访问日志，确认是否存在越权浏览记录。 处理建议：尽快升级或启用修复项，并收紧最小权限、项目隔离与审计告警。';
    if (text.includes('claude code'))
      return '排查是否中招：确认团队是否安装受影响版本，并检查 workspace trust、日志、缓存和配置中是否出现源码片段、敏感路径或凭证泄露。 处理建议：立即升级到修复版本，清理本地缓存与日志，轮换可疑凭证，并复查受影响机器上的信任配置与工作区授权。';
    return '排查是否中招：确认团队是否使用相关开发工具、插件或代理，并检查最近一周的日志、缓存、工作区权限与凭证暴露情况。 处理建议：优先升级到修复版本，必要时暂停相关能力、轮换凭证，并补做终端、本地工作区与审计日志排查。';
  }
  if (category === 'ai-tech') {
    if (/\b(gemini|claude|gpt|qwen|glm|phi|nemotron|model|reasoning|audio|voice|multimodal)\b/.test(text))
      return '建议安排模型接入或基准测试，重点评估复杂推理、多模态、实时语音链路和成本延迟表现，再决定是否进入主链路试点。';
    if (/\b(langchain|langgraph|middleware|sdk|runtime|agent|workflow|memory)\b/.test(text))
      return '建议架构组评估是否需要把中间件、可观测性、权限控制或持久化状态能力纳入当前 Agent 运行时重构计划。';
    if (/\b(benchmark|swe-bench|eval|ranking)\b/.test(text))
      return '建议把这类结果纳入模型选型看板，与现有成本、时延、成功率和稳定性指标一起做交叉验证。';
    return '建议判断是否需要做 SDK 接入 PoC、能力基准测试、推理链路试验、平台侧模型切换评估，必要时进入 Agent 编排验证清单。';
  }
  if (/\b(eslint|flat config|lint)\b/.test(text))
    return '建议停止老项目无脑升级，先盘点脚手架模板与第三方插件兼容性，再安排 Flat Config 迁移计划。';
  if (/\b(typescript|strict|esm)\b/.test(text))
    return '建议更新团队 TypeScript 规范，升级前先检查 strict、ESM 和旧版 CommonJS 兼容项，再安排一次 tsc 演练。';
  if (/\b(astro|vite|environment api|ssr)\b/.test(text))
    return '建议安排构建链路和 SSR 验证，重点评估 Vite Environment API、插件兼容和 Astro 升级窗口。';
  if (/\b(css|light-dark|prefers-color-scheme|images?)\b/.test(text))
    return '建议在组件库或设计系统中安排小范围试点，验证图像资源切换、暗黑模式和浏览器兼容性。';
  if (/react|vite|vue|next|typescript/i.test(`${item.title} ${item.summary}`))
    return '建议判断是否需要安排版本升级、脚手架/模板调整、构建链路验证或规范修订，并在前端周会跟踪。';
  return '建议记录到技术雷达或升级待办，结合现有项目节奏决定是否进入验证。';
}

export function buildCoreChange(category: TechBriefingCategory, item: TechBriefingItem) {
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

export function itemTypeLabel(category: TechBriefingCategory, item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (category === 'frontend-security') {
    if (/\b(node\.js|nodejs|tls|hashdos|bff|ssr)\b/.test(text)) return '运行时高危漏洞';
    if (/\b(chrome|webgl|webcodecs|use-after-free|browser)\b/.test(text)) return '浏览器高危漏洞';
    if (/\b(v8|webassembly|wasm)\b/.test(text)) return '运行时沙箱漏洞';
    if (/\b(supply chain|rat|投毒|compromised)\b/.test(text)) return '高危供应链投毒';
    if (/\b(apifox|js|cdn)\b/.test(text)) return '三方污染';
    return '安全事件';
  }
  if (category === 'general-security') {
    if (/\b(node\.js|nodejs|linux|windows|macos)\b/.test(text)) return '运行时与 OS 安全';
    if (/\b(postgres|postgresql|redis)\b/.test(text)) return '数据库安全公告';
    if (/\b(kubernetes|docker)\b/.test(text)) return '基础设施安全公告';
    return '通用高危安全';
  }
  if (category === 'devtool-security') {
    if (/\b(mcp|cursor|windsurf|path traversal|uri)\b/.test(text)) return '本地沙箱逃逸';
    if (/\b(langgraph|checkpointer|sqlite|postgres|memory|deserialize)\b/.test(text)) return '状态机污染';
    if (/\b(hugging face|spaces|gradio|env|environment)\b/.test(text)) return '凭证与环境暴露';
    if (/\b(langsmith|permission|rbac|project)\b/.test(text)) return '调试台权限';
    return '源码与凭证泄露';
  }
  if (category === 'ai-tech') {
    if (/\b(gemini|claude|gpt|qwen|glm|phi|nemotron|model|reasoning|audio|voice|multimodal)\b/.test(text))
      return '核心模型演进';
    if (/\b(benchmark|swe-bench|eval|ranking)\b/.test(text)) return '模型评测与风向';
    if (/\b(langgraph|agent|workflow)\b/.test(text)) return '架构实践';
    if (/\b(middleware|framework|platform|sdk|api|runtime|langchain)\b/.test(text)) return '框架、工具与平台';
    if (/\b(model|api|sdk)\b/.test(text)) return '模型接入';
    return 'AI 工程更新';
  }
  if (category === 'backend-tech') {
    if (/\b(node\.js|nodejs|bun|deno)\b/.test(text)) return '服务端运行时';
    if (/\b(go|rust|java|spring|dotnet|\.net)\b/.test(text)) return '语言与框架';
    return '后端工程更新';
  }
  if (category === 'cloud-infra-tech') {
    if (/\b(kubernetes|docker|terraform)\b/.test(text)) return '编排与基础设施';
    if (/\b(github actions|gitlab ci|ci\/cd|cicd)\b/.test(text)) return 'CI/CD 变更';
    if (/\b(serverless|edge|cloudflare|vercel|aws)\b/.test(text)) return '边缘与 Serverless';
    return '云原生更新';
  }
  if (/\b(chrome|view transitions?|browser)\b/.test(text)) return '浏览器新特性';
  if (/\b(eslint|flat config|lint)\b/.test(text)) return '前端基建';
  if (/\b(typescript|strict|esm)\b/.test(text)) return '语言迭代';
  if (/\b(astro|vite|environment api|ssr)\b/.test(text)) return '构建与框架';
  if (/\b(css|light-dark|prefers-color-scheme|images?)\b/.test(text)) return 'CSS 原生能力';
  if (/\b(nextjs|next\.js|adapter)\b/.test(text)) return '框架与部署';
  return '前端工程更新';
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
