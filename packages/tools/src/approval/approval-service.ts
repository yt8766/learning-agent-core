import { loadSettings, type RuntimeSettings } from '@agent/config';
import { ActionIntent, ApprovalDecision, ApprovalStatus, type ToolDefinition } from '@agent/core';
import {
  defaultPreflightStaticRules,
  evaluatePermissionCheckers,
  evaluateStaticPolicy,
  HttpMethodPermissionChecker,
  mergeGovernanceDecisions,
  TerminalToolPermissionChecker,
  WorkspacePathPermissionChecker
} from './preflight-governance';
import {
  DESTRUCTIVE_COMMAND_PATTERNS,
  GOVERNANCE_INTENTS,
  HIGH_RISK_TARGET_PATTERNS,
  SAFE_TERMINAL_COMMAND_PATTERNS,
  isDangerousPath,
  matchesAny,
  shouldInvokeClassifier
} from './approval-rules';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export interface ApprovalEvaluationInput {
  intent?: ActionIntentValue | string;
  executionMode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  profile?: string;
  command?: string;
  path?: string;
  fromPath?: string;
  toPath?: string;
  targetRoot?: string;
  url?: string;
  method?: string;
  target?: string;
  actionPrompt?: string;
  serverId?: string;
  capabilityId?: string;
}

export interface ApprovalEvaluationResult {
  requiresApproval: boolean;
  preflightDecision?: 'allow' | 'ask' | 'deny';
  reasonCode:
    | 'approved_by_policy'
    | 'requires_approval_destructive'
    | 'requires_approval_governance'
    | 'requires_approval_missing_preview'
    | 'requires_approval_profile_override'
    | 'requires_approval_tool_policy'
    | 'preflight_denied';
  reason: string;
}

export interface ApprovalClassifierInput {
  intent: ActionIntentValue;
  tool?: ToolDefinition;
  input?: ApprovalEvaluationInput;
}

export type ApprovalClassifier = (input: ApprovalClassifierInput) => Promise<
  | {
      decision: 'allow' | 'ask' | 'deny';
      reason: string;
    }
  | undefined
>;

export class ApprovalService {
  private readonly settings: RuntimeSettings;
  private readonly staticRules = defaultPreflightStaticRules();
  private readonly permissionCheckers = [
    new TerminalToolPermissionChecker(),
    new WorkspacePathPermissionChecker(),
    new HttpMethodPermissionChecker()
  ];
  private readonly classifier?: ApprovalClassifier;

  constructor(settings: RuntimeSettings = loadSettings(), options?: { classifier?: ApprovalClassifier }) {
    this.settings = settings;
    this.classifier = options?.classifier;
  }

  evaluate(
    intent: ActionIntentValue,
    tool?: ToolDefinition,
    input?: ApprovalEvaluationInput
  ): ApprovalEvaluationResult {
    const governanceDecision = mergeGovernanceDecisions(
      evaluateStaticPolicy(this.staticRules, tool, { ...input, intent }, this.settings),
      evaluatePermissionCheckers(this.permissionCheckers, tool, { ...input, intent })
    );
    if (governanceDecision?.decision === 'deny') {
      return {
        requiresApproval: true,
        preflightDecision: 'deny',
        reasonCode: 'preflight_denied',
        reason: governanceDecision.reason
      };
    }
    if (governanceDecision?.decision === 'ask') {
      return {
        requiresApproval: true,
        preflightDecision: 'ask',
        reasonCode: 'requires_approval_tool_policy',
        reason: governanceDecision.reason
      };
    }

    if (tool?.requiresApproval && tool.category !== 'action') {
      return {
        requiresApproval: true,
        preflightDecision: governanceDecision?.decision,
        reasonCode: 'requires_approval_tool_policy',
        reason: `${tool.name} 已被工具策略标记为必须审批。`
      };
    }

    if (GOVERNANCE_INTENTS.has(intent) || tool?.name === 'ship_release') {
      return {
        requiresApproval: true,
        preflightDecision: governanceDecision?.decision,
        reasonCode: 'requires_approval_governance',
        reason: '技能、规则、插件治理与发布类动作默认需要人工审批。'
      };
    }

    if (intent === ActionIntent.READ_FILE) {
      return {
        requiresApproval: false,
        preflightDecision: governanceDecision?.decision ?? 'allow',
        reasonCode: 'approved_by_policy',
        reason: '只读操作默认自动通过。'
      };
    }

    if (tool?.name === 'run_terminal') {
      if (!input?.command) {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_missing_preview',
          reason: '终端命令缺少 command 预览，默认转人工审批。'
        };
      }
      if (matchesAny(input.command, DESTRUCTIVE_COMMAND_PATTERNS)) {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_destructive',
          reason: '检测到破坏性命令，必须人工审批。'
        };
      }
      if (matchesAny(input.command, SAFE_TERMINAL_COMMAND_PATTERNS)) {
        return {
          requiresApproval: false,
          preflightDecision: governanceDecision?.decision ?? 'allow',
          reasonCode: 'approved_by_policy',
          reason: 'build/test/typecheck 等安全命令默认自动通过。'
        };
      }
      if (this.settings.policy.approvalMode === 'strict') {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_profile_override',
          reason: `当前 profile=${this.settings.profile} 对未识别命令保持保守审批。`
        };
      }
    }

    if (intent === ActionIntent.WRITE_FILE) {
      const writeTarget = input?.path ?? input?.targetRoot;
      if (!writeTarget) {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_missing_preview',
          reason: '文件写入缺少 path/targetRoot 预览，默认转人工审批。'
        };
      }
      if (isDangerousPath(writeTarget)) {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_destructive',
          reason: `路径 ${writeTarget} 属于隐藏目录或敏感位置，默认需要人工审批。`
        };
      }
      if (this.settings.policy.approvalPolicy.safeWriteAutoApprove) {
        return {
          requiresApproval: false,
          preflightDecision: governanceDecision?.decision ?? 'allow',
          reasonCode: 'approved_by_policy',
          reason: `当前 profile=${this.settings.profile} 允许安全工作区写入自动通过。`
        };
      }
    }

    if (intent === ActionIntent.DELETE_FILE || tool?.name === 'delete_local_file') {
      if (!input?.path) {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_missing_preview',
          reason: '文件删除缺少 path 预览，默认转人工审批。'
        };
      }
      return {
        requiresApproval: true,
        preflightDecision: governanceDecision?.decision,
        reasonCode: 'requires_approval_destructive',
        reason: `删除 ${input.path} 属于破坏性动作，默认需要人工审批。`
      };
    }

    if (intent === ActionIntent.SCHEDULE_TASK || tool?.name === 'schedule_task') {
      if (!input?.target && !input?.actionPrompt && !input?.path) {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_missing_preview',
          reason: '定时任务缺少目标说明或预览，默认转人工审批。'
        };
      }
      return {
        requiresApproval: true,
        preflightDecision: governanceDecision?.decision,
        reasonCode: 'requires_approval_governance',
        reason: '定时任务会持续触发后续执行，默认需要人工审批。'
      };
    }

    if (
      tool?.name === 'find-skills' ||
      tool?.name === 'search_memory' ||
      tool?.name === 'local-analysis' ||
      tool?.name === 'collect_research_source' ||
      tool?.name === 'webSearchPrime' ||
      tool?.name === 'webReader' ||
      tool?.name === 'search_doc'
    ) {
      return {
        requiresApproval: false,
        preflightDecision: governanceDecision?.decision ?? 'allow',
        reasonCode: 'approved_by_policy',
        reason: '检索与知识分析动作默认自动通过。'
      };
    }

    if (intent === ActionIntent.CALL_EXTERNAL_API || tool?.name === 'http_request' || tool?.name === 'browse_page') {
      if (tool?.name === 'browse_page') {
        return {
          requiresApproval: false,
          preflightDecision: governanceDecision?.decision ?? 'allow',
          reasonCode: 'approved_by_policy',
          reason: '浏览与检索类动作默认自动通过。'
        };
      }
      if (!input?.url) {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_missing_preview',
          reason: '外部请求缺少 URL 预览，默认转人工审批。'
        };
      }
      const method = String(input.method ?? 'GET').toUpperCase();
      if (method === 'DELETE') {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_destructive',
          reason: 'DELETE 请求默认需要人工审批。'
        };
      }
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return {
          requiresApproval: false,
          preflightDecision: governanceDecision?.decision ?? 'allow',
          reasonCode: 'approved_by_policy',
          reason: `${method} 请求默认视为安全读取。`
        };
      }
      if (this.settings.policy.approvalMode === 'strict') {
        return {
          requiresApproval: true,
          preflightDecision: governanceDecision?.decision,
          reasonCode: 'requires_approval_profile_override',
          reason: `当前 profile=${this.settings.profile} 对外部写请求默认保持审批。`
        };
      }
      return {
        requiresApproval: false,
        preflightDecision: governanceDecision?.decision ?? 'allow',
        reasonCode: 'approved_by_policy',
        reason: `${method} 请求不属于删除类操作，按当前策略自动通过。`
      };
    }

    if (input?.target && matchesAny(input.target, HIGH_RISK_TARGET_PATTERNS)) {
      return {
        requiresApproval: true,
        preflightDecision: governanceDecision?.decision,
        reasonCode: 'requires_approval_governance',
        reason: `目标 ${input.target} 涉及发布或生产环境，默认需要审批。`
      };
    }

    if (tool?.requiresApproval && !this.settings.policy.approvalPolicy.safeWriteAutoApprove) {
      return {
        requiresApproval: true,
        preflightDecision: governanceDecision?.decision,
        reasonCode: 'requires_approval_tool_policy',
        reason: `${tool.name} 在当前 profile=${this.settings.profile} 下默认需要审批。`
      };
    }

    return {
      requiresApproval: Boolean(tool?.requiresApproval),
      preflightDecision: governanceDecision?.decision ?? (tool?.isReadOnly ? 'allow' : undefined),
      reasonCode: tool?.requiresApproval ? 'requires_approval_tool_policy' : 'approved_by_policy',
      reason: tool?.requiresApproval ? `${tool.name} 默认需要人工审批。` : '当前动作未命中高风险规则，自动通过。'
    };
  }

  requiresApproval(intent: ActionIntentValue, tool?: ToolDefinition, input?: ApprovalEvaluationInput): boolean {
    return this.evaluate(intent, tool, input).requiresApproval;
  }

  getDefaultDecision(
    intent: ActionIntentValue,
    tool?: ToolDefinition,
    input?: ApprovalEvaluationInput
  ): ApprovalStatus {
    return this.requiresApproval(intent, tool, input) ? 'pending' : ApprovalDecision.APPROVED;
  }

  async evaluateWithClassifier(
    intent: ActionIntentValue,
    tool?: ToolDefinition,
    input?: ApprovalEvaluationInput
  ): Promise<ApprovalEvaluationResult> {
    const base = this.evaluate(intent, tool, input);
    if (!this.classifier || !tool) {
      return base;
    }

    const shouldClassify =
      base.preflightDecision === 'ask' ||
      (base.preflightDecision === undefined && shouldInvokeClassifier(intent, tool, input));
    if (!shouldClassify) {
      return base;
    }

    const classified = await this.classifier({
      intent,
      tool,
      input: {
        ...input,
        profile: input?.profile ?? this.settings.profile
      }
    });
    if (!classified) {
      return base;
    }

    if (classified.decision === 'deny') {
      return {
        requiresApproval: true,
        preflightDecision: 'deny',
        reasonCode: 'preflight_denied',
        reason: classified.reason
      };
    }
    if (classified.decision === 'ask') {
      return {
        requiresApproval: true,
        preflightDecision: 'ask',
        reasonCode: 'requires_approval_tool_policy',
        reason: classified.reason
      };
    }

    if (base.preflightDecision === 'ask') {
      return {
        ...base,
        requiresApproval: false,
        preflightDecision: 'allow',
        reasonCode: 'approved_by_policy',
        reason: classified.reason
      };
    }

    return {
      ...base,
      preflightDecision: 'allow',
      reason: classified.reason
    };
  }
}
