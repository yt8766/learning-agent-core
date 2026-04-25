import {
  BookOpenCheck,
  Cable,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  RadioTower,
  Router,
  ServerCog
} from 'lucide-react';
import type { FormEvent } from 'react';

import type { AdminConsoleData } from '@/admin/admin-console-data';
import { ApiKeysSection, ModelsSection, ProvidersSection } from '@/admin/admin-console-sections';
import { LogsSection } from '@/admin/admin-logs-section';
import { activityItems, type GatewayCenterId } from '@/components/dashboard-data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const centerPages: Record<
  GatewayCenterId,
  {
    title: string;
    eyebrow: string;
    description: string;
    icon: typeof RadioTower;
  }
> = {
  runtime: {
    title: '运行中枢',
    eyebrow: '运行态',
    description: '请求量、延迟、失败率与兜底策略在这里汇总，用来观察网关运行态。',
    icon: RadioTower
  },
  models: {
    title: '模型中枢',
    eyebrow: '模型',
    description: '管理别名、服务商模型、能力标签、价格、兜底别名与模型启停。',
    icon: Router
  },
  providers: {
    title: '服务商中枢',
    eyebrow: '服务商',
    description: '服务商健康、基础地址、类型、凭据状态与轮换入口在这里集中治理。',
    icon: ServerCog
  },
  keys: {
    title: '凭证中枢',
    eyebrow: '调用凭证',
    description: '调用凭证权限、模型范围、每分钟限制、吊销状态与今日调用量在这里查看。',
    icon: KeyRound
  },
  logs: {
    title: '日志与成本',
    eyebrow: '用量账本',
    description: '请求日志、热门模型、热门凭证、热门服务商、token、成本、延迟与错误在这里沉淀。',
    icon: ChartNoAxesCombined
  },
  'connector-policy': {
    title: '连接器与策略',
    eyebrow: '策略',
    description: '服务商策略、兜底策略、频率限制、凭证与模型权限在这里收束。',
    icon: Cable
  },
  approvals: {
    title: '审批中枢',
    eyebrow: '审批',
    description: '高风险网关动作进入审批门，例如凭据轮换、凭证吊销、模型启停与策略变更。',
    icon: ClipboardCheck
  },
  evidence: {
    title: '证据中心',
    eyebrow: '证据',
    description: '证据台账记录请求追踪、错误证据、服务商响应摘要与审计引用。',
    icon: BookOpenCheck
  }
};

export function getGatewayCenterTitle(center: GatewayCenterId) {
  return centerPages[center].title;
}

export function GatewayCenterPage({
  center,
  data,
  error,
  isLoading = false,
  management
}: {
  center: GatewayCenterId;
  data?: Required<AdminConsoleData>;
  error?: string | null;
  isLoading?: boolean;
  management?: {
    oneTimeApiKey: string | null;
    onCreateApiKey: (event: FormEvent<HTMLFormElement>) => void;
    onCreateModel: (event: FormEvent<HTMLFormElement>) => void;
    onCreateProvider: (event: FormEvent<HTMLFormElement>) => void;
    onDeleteApiKey: (keyId: string) => void;
    onDeleteModel: (modelId: string) => void;
    onDeleteProvider: (providerId: string) => void;
    onRevokeApiKey: (keyId: string) => void;
    onUpdateApiKey: (keyId: string, event: FormEvent<HTMLFormElement>) => void;
    onUpdateModel: (modelId: string, event: FormEvent<HTMLFormElement>) => void;
    onUpdateProvider: (providerId: string, event: FormEvent<HTMLFormElement>) => void;
  };
}) {
  const page = centerPages[center];
  const content = buildCenterContent(center, data);
  const safeData = readSafeData(data);
  const Icon = page.icon;

  return (
    <div className="flex flex-col gap-5 px-5 py-5 md:gap-6 md:px-6 md:py-6">
      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Badge variant="secondary" className="w-fit">
                  {page.eyebrow}
                </Badge>
                <div>
                  <CardTitle className="text-2xl">{page.title}</CardTitle>
                  <CardDescription className="mt-2 max-w-3xl text-sm leading-6">{page.description}</CardDescription>
                </div>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-background">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {content.metrics.map(metric => (
                <div className="rounded-md border bg-muted/30 p-3" key={metric.label}>
                  <p className="text-xs font-medium uppercase text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">运行脉冲</CardTitle>
            <CardDescription>
              {isLoading
                ? '正在通过后台接口加载数据。'
                : error
                  ? `接口加载失败：${error}`
                  : '横跨网关后台各中心的共享信号。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityItems.map((item, index) => (
              <div key={item.label}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.value}</p>
                  </div>
                </div>
                {index < activityItems.length - 1 ? <Separator className="mt-4" /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">中心工作负载</CardTitle>
          <CardDescription>对应大模型网关已有后台能力的真实页面内容。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>界面</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>归属</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.rows.map(row => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      {row.state}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.owner}</TableCell>
                  <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {management ? <CenterManagement center={center} data={safeData} management={management} /> : null}
    </div>
  );
}

function CenterManagement({
  center,
  data,
  management
}: {
  center: GatewayCenterId;
  data: Required<AdminConsoleData>;
  management: NonNullable<Parameters<typeof GatewayCenterPage>[0]['management']>;
}) {
  if (center === 'keys') {
    return (
      <>
        {management.oneTimeApiKey ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">一次性调用凭证</CardTitle>
              <CardDescription>只在创建后显示一次，离开页面后不会再次展示明文。</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="block overflow-x-auto rounded-md border bg-muted p-3 font-mono text-sm">
                {management.oneTimeApiKey}
              </code>
            </CardContent>
          </Card>
        ) : null}
        <ApiKeysSection
          keys={data.keys}
          onCreate={management.onCreateApiKey}
          onDelete={management.onDeleteApiKey}
          onRevoke={management.onRevokeApiKey}
          onUpdate={management.onUpdateApiKey}
        />
      </>
    );
  }

  if (center === 'providers') {
    return (
      <ProvidersSection
        providers={data.providers}
        onCreate={management.onCreateProvider}
        onDelete={management.onDeleteProvider}
        onUpdate={management.onUpdateProvider}
      />
    );
  }

  if (center === 'models') {
    return (
      <ModelsSection
        models={data.models}
        providers={data.providers}
        onCreate={management.onCreateModel}
        onDelete={management.onDeleteModel}
        onUpdate={management.onUpdateModel}
      />
    );
  }

  if (center === 'logs') {
    return <LogsSection operations={data.operations} />;
  }

  return null;
}

function buildCenterContent(center: GatewayCenterId, data?: Required<AdminConsoleData>) {
  const safeData = readSafeData(data);

  if (center === 'runtime') {
    const summary = safeData.operations.dashboard.summary;
    return {
      metrics: [
        { label: '今日请求', value: summary.requestCount.toLocaleString(), detail: '来自后台统计接口' },
        { label: '平均延迟', value: `${summary.averageLatencyMs}ms`, detail: '按请求日志聚合' },
        { label: '失败率', value: formatPercent(summary.failureRate), detail: '按错误状态计算' }
      ],
      rows: [
        ...safeData.operations.dashboard.topModels.map(item => ({
          name: `热门模型 ${item.model}`,
          state: `${item.requestCount} 次`,
          owner: '模型',
          detail: `${item.totalTokens.toLocaleString()} token / ${formatCost(item.estimatedCost)}`
        })),
        ...safeData.operations.dashboard.topProviders.map(item => ({
          name: `热门服务商 ${item.provider}`,
          state: `${item.requestCount} 次`,
          owner: '服务商',
          detail: `${item.totalTokens.toLocaleString()} token / ${formatCost(item.estimatedCost)}`
        }))
      ].slice(0, 6)
    };
  }

  if (center === 'models') {
    const enabledCount = safeData.models.filter(model => model.enabled).length;
    const adminOnlyCount = safeData.models.filter(model => model.adminOnly).length;
    const fallbackCount = safeData.models.filter(model => model.fallbackAliases.length > 0).length;
    return {
      metrics: [
        { label: '已启用模型', value: String(enabledCount), detail: '来自模型管理接口' },
        { label: '兜底链路', value: String(fallbackCount), detail: '配置了兜底别名的模型' },
        { label: '仅管理员可用', value: String(adminOnlyCount), detail: '限制在私有操作中使用' }
      ],
      rows: safeData.models.map(model => ({
        name: model.alias,
        state: model.enabled ? '已启用' : '已停用',
        owner: model.providerId,
        detail: `${model.providerModel} / ${model.contextWindow.toLocaleString()} 上下文`
      }))
    };
  }

  if (center === 'providers') {
    const activeProviders = safeData.providers.filter(provider => provider.status === 'active').length;
    const activeCredentials = safeData.providers.filter(provider => provider.credentialStatus === 'active').length;
    return {
      metrics: [
        { label: '活跃服务商', value: `${activeProviders}/${safeData.providers.length}`, detail: '来自服务商管理接口' },
        { label: '有效凭据', value: String(activeCredentials), detail: '服务商凭据状态摘要' },
        {
          label: '服务商类型',
          value: String(new Set(safeData.providers.map(provider => provider.kind)).size),
          detail: '已接入适配器类型数'
        }
      ],
      rows: safeData.providers.map(provider => ({
        name: provider.name,
        state: formatStatus(provider.status),
        owner: provider.kind,
        detail: `${provider.baseUrl} / ${provider.credentialKeyPrefix ? `凭据 ${provider.credentialKeyPrefix}` : '暂无凭据'}`
      }))
    };
  }

  if (center === 'keys') {
    const activeKeys = safeData.keys.filter(key => key.status === 'active').length;
    const limitedKeys = safeData.keys.filter(key => !key.allowAllModels || key.rpmLimit).length;
    const revokedKeys = safeData.keys.filter(key => key.status === 'revoked').length;
    return {
      metrics: [
        { label: '活跃凭证', value: String(activeKeys), detail: '来自调用凭证接口' },
        { label: '受限凭证', value: String(limitedKeys), detail: '模型范围、RPM、TPM 或每日额度限制' },
        { label: '已吊销凭证', value: String(revokedKeys), detail: '保留用于审计追踪' }
      ],
      rows: safeData.keys.map(key => ({
        name: key.name,
        state: formatStatus(key.status),
        owner: key.keyPrefix,
        detail: [
          key.allowAllModels ? '全部模型' : key.models.join(', '),
          `RPM ${key.rpmLimit ?? '无限制'}`,
          `TPM ${key.tpmLimit ?? '无限制'}`,
          `每日 token ${key.dailyTokenLimit ?? '无限制'}`,
          `每日成本 ${key.dailyCostLimit ?? '无限制'}`,
          `今日 ${key.requestCountToday} 次`
        ].join(' / ')
      }))
    };
  }

  if (center === 'logs') {
    const summary = safeData.operations.dashboard.summary;
    return {
      metrics: [
        { label: '总 token', value: summary.totalTokens.toLocaleString(), detail: '来自日志聚合接口' },
        { label: '预估成本', value: formatCost(summary.estimatedCost), detail: '按服务商价格归一化计算' },
        {
          label: '错误日志',
          value: String(safeData.operations.logs.filter(log => log.status === 'error').length),
          detail: '已脱敏的服务商错误'
        }
      ],
      rows: safeData.operations.logs.map(log => ({
        name: log.model,
        state: formatStatus(log.status),
        owner: log.provider,
        detail: `${log.keyId} / ${log.totalTokens.toLocaleString()} token / ${log.latencyMs}ms`
      }))
    };
  }

  return {
    metrics: [
      { label: '接口状态', value: '待接入', detail: '当前仓库尚未提供该中心的专用后台接口' },
      { label: '数据来源', value: '无', detail: '不会展示静态伪数据' },
      { label: '下一步', value: '定义契约', detail: '先补接口文档与 schema，再接页面' }
    ],
    rows: [
      {
        name: centerPages[center].title,
        state: '待接入 API',
        owner: '后台契约',
        detail: '该中心暂不伪造数据，等待稳定接口后再展示真实记录。'
      }
    ]
  };
}

function readSafeData(data?: Required<AdminConsoleData>): Required<AdminConsoleData> {
  return (
    data ?? {
      keys: [],
      providers: [],
      models: [],
      operations: {
        dashboard: {
          summary: { requestCount: 0, totalTokens: 0, estimatedCost: 0, failureRate: 0, averageLatencyMs: 0 },
          topModels: [],
          topKeys: [],
          topProviders: []
        },
        logs: []
      }
    }
  );
}

function formatCost(value: number) {
  return `$${value.toFixed(6)}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    active: '活跃',
    disabled: '停用',
    enabled: '已启用',
    revoked: '已吊销',
    rotated: '已轮换',
    success: '成功',
    error: '错误',
    timeout: '超时'
  };
  return labels[status] ?? status;
}
