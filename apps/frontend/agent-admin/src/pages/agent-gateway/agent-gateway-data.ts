import { Bot, Brain, Boxes, CircleGauge, FileCheck2, KeyRound, Network, ShieldCheck, Sparkles } from 'lucide-react';

export type GatewayProviderKey = 'gemini' | 'codex' | 'claude' | 'vertex' | 'openai' | 'agentflow';

export const PROVIDERS: Array<{
  key: GatewayProviderKey;
  name: string;
  title: string;
  action: string;
  empty: string;
  tone: string;
}> = [
  {
    key: 'gemini',
    name: 'Gemini',
    title: 'Gemini API 密钥',
    action: '添加密钥',
    empty: '暂无 Gemini 密钥',
    tone: 'gemini'
  },
  { key: 'codex', name: 'Codex', title: 'Codex API 配置', action: '添加配置', empty: '暂无 Codex 配置', tone: 'codex' },
  {
    key: 'claude',
    name: 'Claude',
    title: 'Claude API 配置',
    action: '添加配置',
    empty: '暂无 Claude 配置',
    tone: 'claude'
  },
  {
    key: 'vertex',
    name: 'Vertex',
    title: 'Vertex API 配置',
    action: '添加配置',
    empty: '暂无 Vertex 配置',
    tone: 'vertex'
  },
  {
    key: 'openai',
    name: 'OpenAI',
    title: 'OpenAI 兼容配置',
    action: '添加配置',
    empty: '暂无 OpenAI 兼容配置',
    tone: 'openai'
  }
];

export const AUTH_FILE_FILTERS = [
  { label: '全部', count: 3, icon: Boxes },
  { label: 'AgentFlow', count: 1, icon: Sparkles },
  { label: 'Codex', count: 1, icon: Bot },
  { label: 'Kimi', count: 1, icon: KeyRound }
];

export const OAUTH_PROVIDERS = [
  { title: 'Codex OAuth', hint: '生成授权链接并等待回调完成。', tone: 'codex' },
  { title: 'Claude OAuth', hint: '连接 Anthropic 账号凭证。', tone: 'claude' },
  { title: 'AgentFlow OAuth', hint: '导入 AgentFlow 认证文件。', tone: 'agentflow' },
  { title: 'Gemini CLI OAuth', hint: '可选项目 ID，留空自动选择。', tone: 'gemini' },
  { title: 'Kimi OAuth', hint: '生成 Kimi 授权流程。', tone: 'openai' }
];

export const QUOTA_SECTIONS = [
  { title: 'Claude 配额', count: 0, icon: Brain, value: 18, note: '暂无可展示额度，等待凭证同步' },
  { title: 'AgentFlow 配额', count: 1, icon: Sparkles, value: 72, note: '1 个凭证处于启用状态' },
  { title: 'Codex 配额', count: 1, icon: Bot, value: 46, note: '今日额度剩余正常' },
  { title: 'Gemini CLI 配额', count: 0, icon: Network, value: 30, note: '等待 OAuth 凭证刷新' },
  { title: 'Kimi 配额', count: 1, icon: CircleGauge, value: 58, note: '模型调用额度可用' }
];

export const SYSTEM_INFO_TILES = [
  { label: '前端版本', value: 'v1.0.0', sub: 'Agent Gateway 管理中心' },
  { label: 'API 版本', value: 'v6.10.5', sub: '管理 API 连接正常' },
  { label: '构建时间', value: '2026/5/4', sub: '最近构建快照' },
  { label: '连接状态', value: 'Connected', sub: '健康巡检通过' }
];

export const SYSTEM_MODELS = [
  { group: '核心模型', icon: Bot, count: 8, models: ['codex-mini', 'codex-pro', 'gpt-4.1'] },
  { group: '推理模型', icon: Brain, count: 6, models: ['claude-sonnet', 'gemini-pro', 'kimi-k2'] },
  { group: '认证来源', icon: FileCheck2, count: 3, models: ['AgentFlow', 'Codex', 'Kimi'] },
  { group: '安全策略', icon: ShieldCheck, count: 5, models: ['oauth-excluded', 'model-alias', 'quota-guard'] }
];
