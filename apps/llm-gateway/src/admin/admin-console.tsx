'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, Router, ScrollText, ServerCog } from 'lucide-react';

import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Toaster } from '../components/ui/sonner';
import { cn } from '../lib/utils';
import { runAdminActionWithFeedback } from './admin-action-feedback';
import {
  apiKeyFormInput,
  createApiKeyFromForm,
  createModelFromForm,
  createProviderFromForm,
  deleteApiKey,
  deleteModel,
  deleteProvider,
  emptyAdminConsoleData,
  loadAdminConsoleData,
  modelFormInput,
  normalizeAdminConsoleData,
  providerFormInput,
  revokeApiKey,
  updateApiKeyFromForm,
  updateModelFromForm,
  updateProviderFromForm,
  type AdminConsoleData
} from './admin-console-data';
import { ApiKeysSection, ModelsSection, ProvidersSection, TabButton } from './admin-console-sections';
import { LogsSection } from './admin-logs-section';

interface AdminConsoleProps {
  initialData?: AdminConsoleData;
  initialPlaintext?: OneTimePlaintext | null;
  initialTab?: AdminTab;
}

interface OneTimePlaintext {
  keyName: string;
  plaintext: string;
}

type AdminTab = 'keys' | 'providers' | 'models' | 'logs';

export function AdminConsole({ initialData, initialPlaintext = null, initialTab = 'keys' }: AdminConsoleProps) {
  const [data, setData] = useState<Required<AdminConsoleData>>(
    normalizeAdminConsoleData(initialData ?? emptyAdminConsoleData)
  );
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [oneTimePlaintext, setOneTimePlaintext] = useState<OneTimePlaintext | null>(initialPlaintext);

  useEffect(() => {
    if (!initialData) {
      void refreshData();
    }
  }, [initialData]);

  const metrics = useMemo(() => buildMetrics(data), [data]);

  async function refreshData() {
    setIsLoading(true);
    setError(null);
    try {
      setData(normalizeAdminConsoleData(await loadAdminConsoleData()));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : '后台数据加载失败。');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const result = await createApiKeyFromForm(apiKeyFormInput(new FormData(event.currentTarget)));
        setData(current => ({ ...current, keys: [result.key, ...current.keys] }));
        setOneTimePlaintext({ keyName: result.key.name, plaintext: result.plaintext });
        event.currentTarget.reset();
      },
      { loading: '正在创建调用凭证...', success: '调用凭证已创建。', error: '调用凭证创建失败。' },
      setError
    );
  }

  async function handleRevokeApiKey(keyId: string) {
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const revoked = await revokeApiKey(keyId);
        setData(current => ({
          ...current,
          keys: current.keys.map(key => (key.id === revoked.id ? revoked : key))
        }));
      },
      { loading: '正在吊销调用凭证...', success: '调用凭证已吊销。', error: '调用凭证吊销失败。' },
      setError
    );
  }

  async function handleUpdateApiKey(keyId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const updated = await updateApiKeyFromForm(keyId, apiKeyFormInput(new FormData(event.currentTarget)));
        setData(current => ({
          ...current,
          keys: current.keys.map(key => (key.id === updated.id ? updated : key))
        }));
      },
      { loading: '正在保存调用凭证...', success: '调用凭证已保存。', error: '调用凭证更新失败。' },
      setError
    );
  }

  async function handleDeleteApiKey(keyId: string) {
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const deleted = await deleteApiKey(keyId);
        setData(current => ({
          ...current,
          keys: current.keys.map(key => (key.id === deleted.id ? deleted : key))
        }));
      },
      { loading: '正在删除调用凭证...', success: '调用凭证已删除。', error: '调用凭证删除失败。' },
      setError
    );
  }

  async function handleCreateProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const provider = await createProviderFromForm(providerFormInput(new FormData(event.currentTarget)));
        setData(current => ({ ...current, providers: [provider, ...current.providers] }));
        event.currentTarget.reset();
      },
      { loading: '正在创建服务商...', success: '服务商已创建。', error: '服务商创建失败。' },
      setError
    );
  }

  async function handleUpdateProvider(providerId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const updated = await updateProviderFromForm(providerId, providerFormInput(new FormData(event.currentTarget)));
        setData(current => ({
          ...current,
          providers: current.providers.map(provider => (provider.id === updated.id ? updated : provider))
        }));
      },
      { loading: '正在保存服务商...', success: '服务商已保存。', error: '服务商更新失败。' },
      setError
    );
  }

  async function handleDeleteProvider(providerId: string) {
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const deleted = await deleteProvider(providerId);
        setData(current => ({
          ...current,
          providers: current.providers.map(provider => (provider.id === deleted.id ? deleted : provider))
        }));
      },
      { loading: '正在删除服务商...', success: '服务商已删除。', error: '服务商删除失败。' },
      setError
    );
  }

  async function handleCreateModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const model = await createModelFromForm(modelFormInput(new FormData(event.currentTarget)));
        setData(current => ({ ...current, models: [model, ...current.models] }));
        event.currentTarget.reset();
      },
      { loading: '正在创建模型...', success: '模型已创建。', error: '模型创建失败。' },
      setError
    );
  }

  async function handleUpdateModel(modelId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const updated = await updateModelFromForm(modelId, modelFormInput(new FormData(event.currentTarget)));
        setData(current => ({
          ...current,
          models: current.models.map(model => (model.id === updated.id ? updated : model))
        }));
      },
      { loading: '正在保存模型...', success: '模型已保存。', error: '模型更新失败。' },
      setError
    );
  }

  async function handleDeleteModel(modelId: string) {
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const deleted = await deleteModel(modelId);
        setData(current => ({
          ...current,
          models: current.models.map(model => (model.id === deleted.id ? deleted : model))
        }));
      },
      { loading: '正在删除模型...', success: '模型已删除。', error: '模型删除失败。' },
      setError
    );
  }

  return (
    <>
      <main className="mx-auto w-[min(1180px,calc(100%_-_40px))] py-7 max-[760px]:w-[min(1180px,calc(100%_-_28px))] max-[760px]:py-5">
        <header className="flex items-center justify-between gap-5 pb-5 max-[760px]:items-start max-[760px]:flex-col">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">私有大模型网关</p>
            <h1 className="text-2xl font-semibold leading-tight tracking-normal text-foreground">管理员控制台</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className={cn(buttonVariants({ variant: 'outline' }))}
              data-slot="button"
              href="https://chatgpt.com/codex/settings/usage"
              rel="noreferrer"
              target="_blank"
            >
              打开 Codex 用量
            </a>
            <Button onClick={refreshData} type="button" variant="outline">
              <RefreshCw aria-hidden="true" />
              刷新
            </Button>
          </div>
        </header>

        <MetricsGrid metrics={metrics} />

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="后台分区">
          <TabButton
            active={activeTab === 'keys'}
            icon={<KeyRound aria-hidden="true" />}
            onClick={() => setActiveTab('keys')}
          >
            调用凭证
          </TabButton>
          <TabButton
            active={activeTab === 'providers'}
            icon={<ServerCog aria-hidden="true" />}
            onClick={() => setActiveTab('providers')}
          >
            服务商
          </TabButton>
          <TabButton
            active={activeTab === 'models'}
            icon={<Router aria-hidden="true" />}
            onClick={() => setActiveTab('models')}
          >
            模型
          </TabButton>
          <TabButton
            active={activeTab === 'logs'}
            icon={<ScrollText aria-hidden="true" />}
            onClick={() => setActiveTab('logs')}
          >
            日志
          </TabButton>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {oneTimePlaintext ? (
          <section className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4" aria-label="一次性调用凭证">
            <div className="flex items-start justify-between gap-3 max-[640px]:flex-col">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">仅展示一次：{oneTimePlaintext.keyName}</p>
                <code className="mt-2 block break-all rounded-md bg-background px-3 py-2 text-sm text-foreground">
                  {oneTimePlaintext.plaintext}
                </code>
              </div>
              <Button onClick={() => setOneTimePlaintext(null)} type="button" variant="outline">
                隐藏明文
              </Button>
            </div>
          </section>
        ) : null}

        {isLoading ? <p className="mt-5 text-sm text-muted-foreground">加载后台数据...</p> : null}

        {activeTab === 'keys' ? (
          <ApiKeysSection
            keys={data.keys}
            onCreate={handleCreateApiKey}
            onDelete={handleDeleteApiKey}
            onRevoke={handleRevokeApiKey}
            onUpdate={handleUpdateApiKey}
          />
        ) : null}
        {activeTab === 'providers' ? (
          <ProvidersSection
            providers={data.providers}
            onCreate={handleCreateProvider}
            onDelete={handleDeleteProvider}
            onUpdate={handleUpdateProvider}
          />
        ) : null}
        {activeTab === 'models' ? (
          <ModelsSection
            models={data.models}
            providers={data.providers}
            onCreate={handleCreateModel}
            onDelete={handleDeleteModel}
            onUpdate={handleUpdateModel}
          />
        ) : null}
        {activeTab === 'logs' ? <LogsSection operations={data.operations} /> : null}
      </main>
      <Toaster />
    </>
  );
}

function MetricsGrid({ metrics }: { metrics: Array<{ label: string; value: string }> }) {
  return (
    <section
      aria-label="Gateway metrics"
      className="grid grid-cols-4 gap-3 max-[820px]:grid-cols-2 max-[460px]:grid-cols-1"
    >
      {metrics.map(metric => (
        <Card className="min-h-[92px]" key={metric.label}>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">{metric.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <strong className="block truncate text-2xl font-semibold leading-tight text-foreground">
              {metric.value}
            </strong>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function buildMetrics(data: AdminConsoleData) {
  const activeKeys = data.keys.filter(key => key.status === 'active').length;
  const activeCredentials = data.providers.filter(provider => provider.credentialStatus === 'active').length;
  const enabledModels = data.models.filter(model => model.enabled).length;
  const requestsToday = data.keys.reduce((count, key) => count + key.requestCountToday, 0);

  return [
    { label: '调用凭证', value: `${activeKeys}/${data.keys.length}` },
    { label: '服务商', value: `${activeCredentials}/${data.providers.length}` },
    { label: '模型', value: `${enabledModels}/${data.models.length}` },
    { label: '今日请求', value: String(requestsToday) }
  ];
}

export {
  createApiKeyFromForm,
  createModelFromForm,
  createProviderFromForm,
  deleteProvider,
  loadAdminConsoleData,
  loadAdminConsoleDataForCenter,
  loadAdminLogsData,
  updateProviderFromForm
} from './admin-console-data';
