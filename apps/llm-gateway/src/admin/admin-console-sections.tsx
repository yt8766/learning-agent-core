'use client';

import { FormEvent, type ReactNode, useState } from 'react';
import { Ban, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field';
import { Input } from '../components/ui/input';
import type { ApiKeyAdminSummary } from '../contracts/admin-api-key';
import type { GatewayModelAdminRecord } from '../contracts/admin-model';
import { cn } from '../lib/utils';
import type { AdminProviderSummary } from './admin-console-data';
import { providerKinds } from './admin-console-data';

type ResourceFormSubmitHandler = (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
type ResourceRowFormSubmitHandler = (id: string, event: FormEvent<HTMLFormElement>) => Promise<void> | void;
type ResourceDeleteHandler = (id: string) => Promise<void> | void;

export function ApiKeysSection({
  keys,
  onCreate,
  onDelete,
  onRevoke,
  onUpdate
}: {
  keys: ApiKeyAdminSummary[];
  onCreate: ResourceFormSubmitHandler;
  onDelete?: ResourceDeleteHandler;
  onRevoke: ResourceDeleteHandler;
  onUpdate?: ResourceRowFormSubmitHandler;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ApiKeyAdminSummary | null>(null);
  const [deleting, setDeleting] = useState<ApiKeyAdminSummary | null>(null);

  const deleteHandler = onDelete ?? onRevoke;

  return (
    <section className="mt-4" aria-labelledby="api-keys-title">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
          <CardTitle id="api-keys-title" className="text-base">
            调用凭证
          </CardTitle>
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" />
            创建调用凭证
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-4 pt-0">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">名称</th>
                <th className="py-2 pr-3">前缀</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">模型</th>
                <th className="py-2 pr-3">每分钟限制</th>
                <th className="py-2 pr-3">Token 额度</th>
                <th className="py-2 pr-3">成本额度</th>
                <th className="py-2 pr-3">今日</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr className="border-t border-border" key={key.id}>
                  <td className="max-w-[160px] truncate py-2 pr-3 font-medium">{key.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{key.keyPrefix}</td>
                  <td className="py-2 pr-3">{formatStatus(key.status)}</td>
                  <td className="max-w-[200px] truncate py-2 pr-3">
                    {key.allowAllModels ? '全部模型' : key.models.join(', ')}
                  </td>
                  <td className="py-2 pr-3">{key.rpmLimit ?? '无限制'}</td>
                  <td className="py-2 pr-3">
                    {key.tpmLimit ?? '无限制'} / {key.dailyTokenLimit ?? '无限制'}
                  </td>
                  <td className="py-2 pr-3">
                    {formatCurrency(key.usedCostToday)} /{' '}
                    {key.dailyCostLimit ? formatCurrency(key.dailyCostLimit) : '无限制'}
                  </td>
                  <td className="py-2 pr-3">{key.requestCountToday} 次</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={key.status === 'revoked' || !onUpdate}
                        onClick={() => setEditing(key)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Pencil aria-hidden="true" />
                        编辑
                      </Button>
                      <Button
                        disabled={key.status === 'revoked'}
                        onClick={() => setDeleting(key)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Ban aria-hidden="true" />
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {keys.length === 0 ? <p className="py-8 text-sm text-muted-foreground">暂无调用凭证</p> : null}
        </CardContent>
      </Card>

      <ResourceFormDialog
        description="填写权限、模型范围与额度后创建新的虚拟调用凭证。"
        onOpenChange={setCreateOpen}
        open={createOpen}
        title="创建调用凭证"
      >
        <form onSubmit={event => void submitResourceForm(event, onCreate, () => setCreateOpen(false))}>
          <ApiKeyFields />
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit">创建</Button>
          </DialogFooter>
        </form>
      </ResourceFormDialog>

      <ResourceFormDialog
        description="编辑只会更新权限、额度和过期时间，不会重新生成明文凭证。"
        onOpenChange={open => setEditing(open ? editing : null)}
        open={Boolean(editing)}
        title="编辑调用凭证"
      >
        {editing ? (
          <form
            onSubmit={event =>
              void submitResourceForm(
                event,
                currentEvent => onUpdate?.(editing.id, currentEvent),
                () => setEditing(null)
              )
            }
          >
            <ApiKeyFields keyRecord={editing} />
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        ) : null}
      </ResourceFormDialog>

      <ConfirmDialog
        description="删除调用凭证会将其软删除为已吊销状态，数据库记录仍会保留用于审计。"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteHandler(deleting.id);
          setDeleting(null);
        }}
        open={Boolean(deleting)}
        title={`确认删除 ${deleting?.name ?? ''}？`}
      />
    </section>
  );
}

export function ProvidersSection({
  onCreate,
  onDelete,
  onUpdate,
  providers
}: {
  onCreate: ResourceFormSubmitHandler;
  onDelete?: ResourceDeleteHandler;
  onUpdate?: ResourceRowFormSubmitHandler;
  providers: AdminProviderSummary[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProviderSummary | null>(null);
  const [deleting, setDeleting] = useState<AdminProviderSummary | null>(null);

  return (
    <section className="mt-4" aria-labelledby="providers-title">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
          <CardTitle id="providers-title" className="text-base">
            服务商
          </CardTitle>
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" />
            创建服务商
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-4 pt-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">名称</th>
                <th className="py-2 pr-3">类型</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">基础地址</th>
                <th className="py-2 pr-3">凭据</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(provider => (
                <tr className="border-t border-border" key={provider.id}>
                  <td className="max-w-[180px] truncate py-2 pr-3 font-medium">{provider.name}</td>
                  <td className="py-2 pr-3">{provider.kind}</td>
                  <td className="py-2 pr-3">{formatStatus(provider.status)}</td>
                  <td className="max-w-[260px] truncate py-2 pr-3">{provider.baseUrl}</td>
                  <td className="py-2 pr-3">
                    {provider.credentialKeyPrefix ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        凭据 {formatStatus(provider.credentialStatus ?? 'unknown')}
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {provider.credentialKeyPrefix}
                        </code>
                      </span>
                    ) : (
                      '暂无凭据'
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setEditing(provider)} size="sm" type="button" variant="outline">
                        <Pencil aria-hidden="true" />
                        编辑
                      </Button>
                      <Button
                        disabled={provider.status === 'disabled'}
                        onClick={() => setDeleting(provider)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 aria-hidden="true" />
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {providers.length === 0 ? <p className="py-8 text-sm text-muted-foreground">暂无服务商</p> : null}
        </CardContent>
      </Card>

      <ResourceFormDialog
        description="填写服务商地址和可选凭据。凭据明文不会在列表中展示。"
        onOpenChange={setCreateOpen}
        open={createOpen}
        title="创建服务商"
      >
        <form onSubmit={event => void submitResourceForm(event, onCreate, () => setCreateOpen(false))}>
          <ProviderFields />
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit">创建</Button>
          </DialogFooter>
        </form>
      </ResourceFormDialog>

      <ResourceFormDialog
        description="编辑基础信息；密钥留空会保留现有凭据，填写新密钥会轮换凭据。"
        onOpenChange={open => setEditing(open ? editing : null)}
        open={Boolean(editing)}
        title="编辑服务商"
      >
        {editing ? (
          <form
            onSubmit={event =>
              void submitResourceForm(
                event,
                currentEvent => onUpdate?.(editing.id, currentEvent),
                () => setEditing(null)
              )
            }
          >
            <ProviderFields provider={editing} />
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        ) : null}
      </ResourceFormDialog>

      <ConfirmDialog
        description="删除服务商会软删除为停用状态，数据库记录仍会保留。"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) onDelete?.(deleting.id);
          setDeleting(null);
        }}
        open={Boolean(deleting)}
        title={`确认删除 ${deleting?.name ?? ''}？`}
      />
    </section>
  );
}

export function ModelsSection({
  models,
  onCreate,
  onDelete,
  onUpdate,
  providers
}: {
  models: GatewayModelAdminRecord[];
  onCreate: ResourceFormSubmitHandler;
  onDelete?: ResourceDeleteHandler;
  onUpdate?: ResourceRowFormSubmitHandler;
  providers: AdminProviderSummary[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GatewayModelAdminRecord | null>(null);
  const [deleting, setDeleting] = useState<GatewayModelAdminRecord | null>(null);

  return (
    <section className="mt-4" aria-labelledby="models-title">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
          <CardTitle id="models-title" className="text-base">
            模型
          </CardTitle>
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" />
            创建模型
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-4 pt-0">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">别名</th>
                <th className="py-2 pr-3">服务商</th>
                <th className="py-2 pr-3">服务商模型</th>
                <th className="py-2 pr-3">上下文</th>
                <th className="py-2 pr-3">能力</th>
                <th className="py-2 pr-3">价格</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <tr className="border-t border-border" key={model.id}>
                  <td className="max-w-[160px] truncate py-2 pr-3 font-medium">{model.alias}</td>
                  <td className="max-w-[180px] truncate py-2 pr-3">{model.providerId}</td>
                  <td className="max-w-[220px] truncate py-2 pr-3">{model.providerModel}</td>
                  <td className="py-2 pr-3">{model.contextWindow.toLocaleString()}</td>
                  <td className="max-w-[240px] truncate py-2 pr-3">{model.capabilities.join(', ')}</td>
                  <td className="py-2 pr-3">
                    {model.inputPricePer1mTokens ?? '-'} / {model.outputPricePer1mTokens ?? '-'}
                  </td>
                  <td className="py-2 pr-3">
                    {model.enabled ? '已启用' : '已停用'}
                    {model.adminOnly ? ' · 仅管理员可见' : ''}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setEditing(model)} size="sm" type="button" variant="outline">
                        <Pencil aria-hidden="true" />
                        编辑
                      </Button>
                      <Button
                        disabled={!model.enabled}
                        onClick={() => setDeleting(model)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 aria-hidden="true" />
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {models.length === 0 ? <p className="py-8 text-sm text-muted-foreground">暂无模型</p> : null}
        </CardContent>
      </Card>

      <ResourceFormDialog
        description="创建可路由模型别名，并配置上下文、价格、能力与兜底链路。"
        onOpenChange={setCreateOpen}
        open={createOpen}
        title="创建模型"
      >
        <form onSubmit={event => void submitResourceForm(event, onCreate, () => setCreateOpen(false))}>
          <ModelFields providers={providers} />
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit">创建</Button>
          </DialogFooter>
        </form>
      </ResourceFormDialog>

      <ResourceFormDialog
        description="编辑会更新模型路由配置，不会删除历史日志。"
        onOpenChange={open => setEditing(open ? editing : null)}
        open={Boolean(editing)}
        title="编辑模型"
      >
        {editing ? (
          <form
            onSubmit={event =>
              void submitResourceForm(
                event,
                currentEvent => onUpdate?.(editing.id, currentEvent),
                () => setEditing(null)
              )
            }
          >
            <ModelFields model={editing} providers={providers} />
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        ) : null}
      </ResourceFormDialog>

      <ConfirmDialog
        description="删除模型会软删除为停用状态，数据库记录仍会保留。"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) onDelete?.(deleting.id);
          setDeleting(null);
        }}
        open={Boolean(deleting)}
        title={`确认删除 ${deleting?.alias ?? ''}？`}
      />
    </section>
  );
}

export function TabButton({
  active,
  children,
  icon,
  onClick
}: {
  active: boolean;
  children: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      aria-selected={active}
      className={cn(active ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : '')}
      onClick={onClick}
      role="tab"
      type="button"
      variant={active ? 'default' : 'outline'}
    >
      {icon}
      {children}
    </Button>
  );
}

function ApiKeyFields({ keyRecord }: { keyRecord?: ApiKeyAdminSummary }) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="api-key-name">名称</FieldLabel>
        <Input id="api-key-name" name="name" required placeholder="预发凭证" defaultValue={keyRecord?.name} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor="api-key-allow-all-models">
        <input
          id="api-key-allow-all-models"
          name="allowAllModels"
          type="checkbox"
          defaultChecked={keyRecord?.allowAllModels ?? true}
        />
        允许全部模型
      </label>
      <Field>
        <FieldLabel htmlFor="api-key-models">模型范围</FieldLabel>
        <Input
          id="api-key-models"
          name="models"
          placeholder="gpt-4o-mini, qwen-plus"
          defaultValue={keyRecord?.models.join(', ')}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="api-key-rpm-limit">每分钟限制</FieldLabel>
        <Input
          id="api-key-rpm-limit"
          min="1"
          name="rpmLimit"
          placeholder="120"
          type="number"
          defaultValue={keyRecord?.rpmLimit ?? ''}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="api-key-tpm-limit">每分钟 Token 限制</FieldLabel>
        <Input
          id="api-key-tpm-limit"
          min="1"
          name="tpmLimit"
          placeholder="120000"
          type="number"
          defaultValue={keyRecord?.tpmLimit ?? ''}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="api-key-daily-token-limit">每日 Token 额度</FieldLabel>
        <Input
          id="api-key-daily-token-limit"
          min="1"
          name="dailyTokenLimit"
          placeholder="1000000"
          type="number"
          defaultValue={keyRecord?.dailyTokenLimit ?? ''}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="api-key-daily-cost-limit">每日成本额度</FieldLabel>
        <Input
          id="api-key-daily-cost-limit"
          min="0"
          name="dailyCostLimit"
          placeholder="20"
          step="0.01"
          type="number"
          defaultValue={keyRecord?.dailyCostLimit ?? ''}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="api-key-expires-at">过期时间</FieldLabel>
        <Input
          id="api-key-expires-at"
          name="expiresAt"
          type="datetime-local"
          defaultValue={dateTimeLocalValue(keyRecord?.expiresAt)}
        />
      </Field>
    </FieldGroup>
  );
}

function ProviderFields({ provider }: { provider?: AdminProviderSummary }) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="provider-name">名称</FieldLabel>
        <Input id="provider-name" name="name" required placeholder="OpenAI 主服务" defaultValue={provider?.name} />
      </Field>
      <Field>
        <FieldLabel htmlFor="provider-kind">类型</FieldLabel>
        <select className={selectClassName()} id="provider-kind" name="kind" defaultValue={provider?.kind ?? 'openai'}>
          {providerKinds.map(kind => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor="provider-base-url">基础地址</FieldLabel>
        <Input
          id="provider-base-url"
          name="baseUrl"
          required
          placeholder="https://api.openai.com/v1"
          defaultValue={provider?.baseUrl}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="provider-timeout-ms">超时时间</FieldLabel>
        <Input
          id="provider-timeout-ms"
          min="1"
          name="timeoutMs"
          placeholder="30000"
          type="number"
          defaultValue={provider?.timeoutMs ?? ''}
        />
      </Field>
      <input name="status" type="hidden" value={provider?.status ?? 'active'} />
      <Field>
        <FieldLabel htmlFor="provider-credential">{provider ? '新凭据' : '凭据'}</FieldLabel>
        <Input
          id="provider-credential"
          name="plaintextApiKey"
          placeholder={provider ? '留空则不变，填写后轮换凭据' : '服务商密钥'}
          type="password"
        />
      </Field>
    </FieldGroup>
  );
}

function ModelFields({ model, providers }: { model?: GatewayModelAdminRecord; providers: AdminProviderSummary[] }) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="model-alias">别名</FieldLabel>
        <Input id="model-alias" name="alias" required placeholder="gpt-4o-mini" defaultValue={model?.alias} />
      </Field>
      <Field>
        <FieldLabel htmlFor="model-provider-id">服务商 ID</FieldLabel>
        <Input
          id="model-provider-id"
          list="provider-id-options"
          name="providerId"
          required
          placeholder="provider_openai_main"
          defaultValue={model?.providerId}
        />
        <datalist id="provider-id-options">
          {providers.map(provider => (
            <option key={provider.id} value={provider.id} />
          ))}
        </datalist>
      </Field>
      <Field>
        <FieldLabel htmlFor="model-provider-model">服务商模型</FieldLabel>
        <Input
          id="model-provider-model"
          name="providerModel"
          required
          placeholder="gpt-4o-mini-2024-07-18"
          defaultValue={model?.providerModel}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="model-context-window">上下文窗口</FieldLabel>
        <Input
          id="model-context-window"
          min="1"
          name="contextWindow"
          required
          type="number"
          defaultValue={model?.contextWindow ?? 128000}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="model-capabilities">能力标签</FieldLabel>
        <Input
          id="model-capabilities"
          name="capabilities"
          defaultValue={model?.capabilities.join(', ') ?? 'chat_completions, streaming'}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="model-input-price">输入价格</FieldLabel>
          <Input
            id="model-input-price"
            min="0"
            name="inputPricePer1mTokens"
            step="0.01"
            type="number"
            defaultValue={model?.inputPricePer1mTokens ?? ''}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="model-output-price">输出价格</FieldLabel>
          <Input
            id="model-output-price"
            min="0"
            name="outputPricePer1mTokens"
            step="0.01"
            type="number"
            defaultValue={model?.outputPricePer1mTokens ?? ''}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="model-fallback-aliases">兜底别名</FieldLabel>
        <Input
          id="model-fallback-aliases"
          name="fallbackAliases"
          placeholder="gpt-4.1-mini"
          defaultValue={model?.fallbackAliases.join(', ')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor="model-enabled">
          <input id="model-enabled" name="enabled" type="checkbox" defaultChecked={model?.enabled ?? true} />
          启用
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor="model-admin-only">
          <input id="model-admin-only" name="adminOnly" type="checkbox" defaultChecked={model?.adminOnly ?? false} />
          仅管理员可见
        </label>
      </div>
    </FieldGroup>
  );
}

function ResourceFormDialog({
  children,
  description,
  onOpenChange,
  open,
  title
}: {
  children: ReactNode;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

async function submitResourceForm(
  event: FormEvent<HTMLFormElement>,
  submit: ResourceFormSubmitHandler,
  close: () => void
): Promise<void> {
  await submit(event);
  close();
}

function ConfirmDialog({
  description,
  onCancel,
  onConfirm,
  open,
  title
}: {
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={nextOpen => (!nextOpen ? onCancel() : undefined)}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function selectClassName(): string {
  return cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  );
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    active: '活跃',
    disabled: '停用',
    revoked: '已吊销',
    rotated: '已轮换',
    error: '错误'
  };
  return labels[status] ?? status;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function dateTimeLocalValue(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.slice(0, 16);
}
