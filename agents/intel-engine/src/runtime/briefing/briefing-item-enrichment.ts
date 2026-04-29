import type { TechBriefingItem } from './briefing.types';

export function computePreferenceScore(
  item: TechBriefingItem,
  preferences: {
    positiveSourceNames: Set<string>;
    negativeSourceNames: Set<string>;
    positiveReasonTags: Set<string>;
    negativeReasonTags: Set<string>;
  }
) {
  let score = 0;
  if (preferences.positiveSourceNames.has(item.sourceName)) score += 3;
  if (preferences.negativeSourceNames.has(item.sourceName)) score -= 3;
  if (
    preferences.positiveReasonTags.has('useful-actionable') &&
    item.recommendedAction &&
    item.recommendedAction !== 'watch'
  )
    score += 2;
  if (preferences.positiveReasonTags.has('too-late') && item.relevanceLevel === 'immediate') score += 1;
  if (preferences.negativeReasonTags.has('too-noisy') && item.recommendedAction === 'watch') score -= 2;
  if (preferences.negativeReasonTags.has('irrelevant') && item.relevanceLevel === 'watch') score -= 2;
  if (preferences.negativeReasonTags.has('too-late') && item.relevanceLevel === 'watch') score -= 1;
  return score;
}

export function enrichActionMetadata(item: TechBriefingItem): TechBriefingItem {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (item.category === 'general-security') {
    const priorityCode = /\b(rce|remote code execution|supply chain|credential|token|权限边界|privilege|bypass)\b/.test(
      text
    )
      ? 'P0'
      : /\b(cve|critical|high severity|kubernetes|docker|postgres|redis|linux|windows|macos|aws|node\.js|nodejs)\b/.test(
            text
          )
        ? 'P1'
        : 'P2';
    return {
      ...item,
      priorityCode,
      actionDeadline: priorityCode === 'P0' ? '24 小时内' : priorityCode === 'P1' ? '本周内' : '下个迭代',
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 60,
      actionSteps: {
        triage: ['确认受影响版本、基础设施暴露面与默认配置', '核对官方安全公告中的利用条件与缓解前提'],
        fix: ['升级到官方修复版本或立即应用缓解措施', '必要时收紧网络、权限、密钥与访问策略'],
        verify: ['验证核心链路、权限边界与健康检查', '确认监控、审计与告警没有持续异常']
      }
    };
  }
  if (item.category === 'backend-tech') {
    const priorityCode = /\b(breaking|deprecated|migration|required)\b/.test(text) ? 'P1' : 'P2';
    return {
      ...item,
      priorityCode,
      actionDeadline: priorityCode === 'P1' ? '本周内' : '下个迭代',
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 60,
      actionSteps: {
        triage: ['确认是否命中当前后端运行时、语言、框架或构建链路', '评估是否影响现网服务、镜像与脚手架模板'],
        fix: ['安排升级、配置迁移或框架适配', '必要时更新 CI 镜像、基础镜像与项目模板'],
        verify: ['执行类型检查、关键接口回归和构建验证', '确认运行环境版本与产物一致']
      }
    };
  }
  if (item.category === 'cloud-infra-tech') {
    const priorityCode = /\b(security|incident|breaking|deprecated|migration|required)\b/.test(text) ? 'P1' : 'P2';
    return {
      ...item,
      priorityCode,
      actionDeadline: priorityCode === 'P1' ? '本周内' : '下个迭代',
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 75,
      actionSteps: {
        triage: [
          '确认是否命中 Kubernetes、Docker、Terraform、Serverless、边缘或 CI/CD 链路',
          '核对集群、流水线与 IaC 模块的受影响范围'
        ],
        fix: ['更新编排、镜像、流水线或 IaC 配置', '必要时补充灰度、回滚与资源隔离策略'],
        verify: ['验证部署、编排、流水线和可观测性指标', '确认发布后无新增告警与回滚信号']
      }
    };
  }
  if (item.category === 'frontend-security' && text.includes('axios')) {
    return {
      ...item,
      affectedVersions: ['1.14.1', '0.30.4'],
      fixedVersions: ['1.14.2+', '0.30.5+'],
      estimatedTriageMinutes: 5,
      estimatedFixMinutes: 30,
      actionDeadline: '24 小时内',
      priorityCode: 'P0',
      actionSteps: {
        triage: [
          '执行 `pnpm why axios` 或 `npm ls axios` 检查命中版本',
          '确认生产依赖、锁文件与镜像是否已拉入受影响包'
        ],
        fix: ['升级到官方修复版本并清理受污染缓存', '必要时轮换可能暴露的 Token、Cookie 或凭证'],
        verify: ['重新安装依赖并执行构建、冒烟与安全回归', '确认产物中不再包含受影响版本']
      }
    };
  }
  if (item.category === 'frontend-security' && text.includes('apifox')) {
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 30,
      actionDeadline: '24 小时内',
      priorityCode: 'P0',
      actionSteps: {
        triage: ['确认最近一周是否加载过受影响 Apifox 资源', '排查浏览器缓存、日志与凭证暴露范围'],
        fix: ['清理缓存并轮换密钥或 Token', '按官方公告完成升级与隔离处置'],
        verify: ['复查调试链路、前端控制台与访问日志', '确认不再加载受影响资源']
      }
    };
  }
  if (item.category === 'frontend-security' && /\b(node\.js|nodejs|tls|hashdos|bff|ssr)\b/.test(text))
    return {
      ...item,
      fixedVersions: ['25.8.2+', '24.14.1+', '22.22.2+', '20.x 官方修复版'],
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 45,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  if (item.category === 'frontend-security' && /\b(chrome|webgl|webcodecs|use-after-free|browser)\b/.test(text))
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 20,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  if (item.category === 'frontend-security' && /\b(v8|webassembly|wasm)\b/.test(text))
    return {
      ...item,
      estimatedTriageMinutes: 15,
      estimatedFixMinutes: 30,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  if (item.category === 'devtool-security' && text.includes('claude code'))
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 20,
      actionDeadline: '24 小时内',
      priorityCode: 'P0'
    };
  if (item.category === 'devtool-security' && /\b(mcp|cursor|windsurf|path traversal|uri)\b/.test(text))
    return {
      ...item,
      estimatedTriageMinutes: 20,
      estimatedFixMinutes: 45,
      actionDeadline: '24 小时内',
      priorityCode: 'P0'
    };
  if (
    item.category === 'devtool-security' &&
    /\b(langgraph|checkpointer|sqlite|postgres|memory|deserialize)\b/.test(text)
  )
    return {
      ...item,
      estimatedTriageMinutes: 15,
      estimatedFixMinutes: 30,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  if (item.category === 'devtool-security' && /\b(hugging face|spaces|gradio|env|environment)\b/.test(text))
    return {
      ...item,
      estimatedTriageMinutes: 15,
      estimatedFixMinutes: 30,
      actionDeadline: '24 小时内',
      priorityCode: 'P0'
    };
  if (item.category === 'devtool-security' && /\b(langsmith|permission|rbac|project)\b/.test(text))
    return {
      ...item,
      estimatedTriageMinutes: 10,
      estimatedFixMinutes: 20,
      actionDeadline: '本周内',
      priorityCode: 'P1'
    };
  return {
    ...item,
    affectedVersions: item.affectedVersions ?? inferAffectedVersions(item),
    fixedVersions: item.fixedVersions ?? inferFixedVersions(item),
    priorityCode:
      item.priorityCode ?? (item.displaySeverity === 'critical' ? 'P0' : item.displaySeverity === 'high' ? 'P1' : 'P2'),
    actionDeadline:
      item.actionDeadline ??
      (item.displaySeverity === 'critical' ? '24 小时内' : item.displaySeverity === 'high' ? '本周内' : '下个迭代'),
    actionSteps: item.actionSteps ?? {
      triage: ['确认是否命中当前技术栈、受影响版本与变更窗口'],
      fix: ['安排升级、配置修正或官方建议的缓解措施'],
      verify: ['完成回归验证并确认告警、日志与产物状态正常']
    }
  };
}

function inferAffectedVersions(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`;
  const explicit = collectVersionCandidates(text, [
    /(?:affected|impacted|vulnerable|受影响版本|影响版本)[^0-9a-zA-Z]{0,12}((?:v?\d+\.\d+(?:\.\d+)?(?:\s*[-~]\s*v?\d+\.\d+(?:\.\d+)?)?(?:\s*,\s*)?){1,4})/gi,
    /(?:before|prior to|earlier than|低于|早于)[^0-9a-zA-Z]{0,8}(v?\d+\.\d+(?:\.\d+)?)/gi
  ]);
  if (explicit.length > 0) return explicit;
  if (item.updateStatus === 'security_status_change' || item.category.includes('security'))
    return collectLooseVersions(text).slice(0, 4);
  return undefined;
}

function inferFixedVersions(item: TechBriefingItem) {
  const text = `${item.title} ${item.summary}`;
  const explicit = collectVersionCandidates(text, [
    /(?:fixed in|patched in|upgrade to|升级到|修复版本|fixed versions?)[^0-9a-zA-Z]{0,12}((?:v?\d+\.\d+(?:\.\d+)?\+?(?:\s*,\s*)?){1,4})/gi,
    /(?:available in|starting from|from)[^0-9a-zA-Z]{0,8}(v?\d+\.\d+(?:\.\d+)?\+?)/gi
  ]);
  if (explicit.length > 0) return explicit.map(version => (version.endsWith('+') ? version : `${version}+`));
  if (item.updateStatus === 'patch_released')
    return collectLooseVersions(text)
      .slice(-2)
      .map(version => (version.endsWith('+') ? version : `${version}+`));
  return undefined;
}

function collectVersionCandidates(text: string, patterns: RegExp[]) {
  const versions: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const segment = match[1] ?? match[0];
      for (const version of collectLooseVersions(segment)) if (!versions.includes(version)) versions.push(version);
    }
  }
  return versions;
}

function collectLooseVersions(text: string) {
  return Array.from(text.matchAll(/\bv?\d+\.\d+(?:\.\d+)?\+?\b/g))
    .map(match => match[0].replace(/^v/i, ''))
    .filter((version, index, array) => array.indexOf(version) === index);
}
