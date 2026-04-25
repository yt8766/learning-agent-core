'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';

import { runAdminActionWithFeedback } from '@/admin/admin-action-feedback';
import {
  apiKeyFormInput,
  createApiKeyFromForm,
  createModelFromForm,
  createProviderFromForm,
  deleteApiKey,
  deleteModel,
  deleteProvider,
  modelFormInput,
  providerFormInput,
  revokeApiKey,
  updateApiKeyFromForm,
  updateModelFromForm,
  updateProviderFromForm
} from '@/admin/admin-console-data';
import { AppSidebar } from '@/components/app-sidebar';
import { GatewayCenterPage, getGatewayCenterTitle } from '@/components/gateway-center-pages';
import { SiteHeader } from '@/components/site-header';
import {
  emptyAdminConsoleData,
  loadAdminConsoleDataForCenter,
  mergeAdminConsoleData,
  normalizeAdminConsoleData,
  type AdminConsoleData
} from '@/admin/admin-console-data';
import type { GatewayCenterId } from '@/components/dashboard-data';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';

export function GatewayDashboard({
  initialData,
  remoteData = false
}: {
  initialData?: AdminConsoleData;
  remoteData?: boolean;
}) {
  const [activeCenter, setActiveCenter] = useState<GatewayCenterId>('runtime');
  const [data, setData] = useState(() => normalizeAdminConsoleData(initialData ?? emptyAdminConsoleData));
  const [isLoading, setIsLoading] = useState(remoteData && !initialData);
  const [error, setError] = useState<string | null>(null);
  const [oneTimeApiKey, setOneTimeApiKey] = useState<string | null>(null);

  async function refreshCenter(center: GatewayCenterId) {
    const nextDataPatch = await loadAdminConsoleDataForCenter(center);
    setData(currentData => mergeAdminConsoleData(currentData, nextDataPatch));
  }

  useEffect(() => {
    if (!remoteData || initialData) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void loadAdminConsoleDataForCenter(activeCenter)
      .then(nextDataPatch => {
        if (!cancelled) {
          setData(currentData => mergeAdminConsoleData(currentData, nextDataPatch));
        }
      })
      .catch(currentError => {
        if (!cancelled) {
          setError(currentError instanceof Error ? currentError.message : '后台数据加载失败。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCenter, initialData, remoteData]);

  async function handleCreateApiKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    await runAdminActionWithFeedback(
      async () => {
        const created = await createApiKeyFromForm(apiKeyFormInput(new FormData(form)));
        setOneTimeApiKey(created.plaintext);
        form.reset();
        await refreshCenter('keys');
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
        setData(currentData => ({
          ...currentData,
          keys: currentData.keys.map(key => (key.id === revoked.id ? revoked : key))
        }));
      },
      { loading: '正在吊销调用凭证...', success: '调用凭证已吊销。', error: '调用凭证吊销失败。' },
      setError
    );
  }

  async function handleUpdateApiKey(keyId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const updated = await updateApiKeyFromForm(keyId, apiKeyFormInput(new FormData(event.currentTarget)));
        setData(currentData => ({
          ...currentData,
          keys: currentData.keys.map(key => (key.id === updated.id ? updated : key))
        }));
      },
      { loading: '正在保存调用凭证...', success: '调用凭证已保存。', error: '调用凭证编辑失败。' },
      setError
    );
  }

  async function handleDeleteApiKey(keyId: string) {
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const deleted = await deleteApiKey(keyId);
        setData(currentData => ({
          ...currentData,
          keys: currentData.keys.map(key => (key.id === deleted.id ? deleted : key))
        }));
      },
      { loading: '正在删除调用凭证...', success: '调用凭证已删除。', error: '调用凭证删除失败。' },
      setError
    );
  }

  async function handleCreateProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    await runAdminActionWithFeedback(
      async () => {
        await createProviderFromForm(providerFormInput(new FormData(form)));
        form.reset();
        await refreshCenter('providers');
      },
      { loading: '正在创建服务商...', success: '服务商已创建。', error: '服务商创建失败。' },
      setError
    );
  }

  async function handleUpdateProvider(providerId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        await updateProviderFromForm(providerId, providerFormInput(new FormData(event.currentTarget)));
        await refreshCenter('providers');
      },
      { loading: '正在保存服务商...', success: '服务商已保存。', error: '服务商编辑失败。' },
      setError
    );
  }

  async function handleDeleteProvider(providerId: string) {
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        await deleteProvider(providerId);
        await refreshCenter('providers');
      },
      { loading: '正在删除服务商...', success: '服务商已删除。', error: '服务商删除失败。' },
      setError
    );
  }

  async function handleCreateModel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    await runAdminActionWithFeedback(
      async () => {
        await createModelFromForm(modelFormInput(new FormData(form)));
        form.reset();
        await refreshCenter('models');
      },
      { loading: '正在创建模型...', success: '模型已创建。', error: '模型创建失败。' },
      setError
    );
  }

  async function handleUpdateModel(modelId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const updated = await updateModelFromForm(modelId, modelFormInput(new FormData(event.currentTarget)));
        setData(currentData => ({
          ...currentData,
          models: currentData.models.map(model => (model.id === updated.id ? updated : model))
        }));
      },
      { loading: '正在保存模型...', success: '模型已保存。', error: '模型编辑失败。' },
      setError
    );
  }

  async function handleDeleteModel(modelId: string) {
    setError(null);
    await runAdminActionWithFeedback(
      async () => {
        const deleted = await deleteModel(modelId);
        setData(currentData => ({
          ...currentData,
          models: currentData.models.map(model => (model.id === deleted.id ? deleted : model))
        }));
      },
      { loading: '正在删除模型...', success: '模型已删除。', error: '模型删除失败。' },
      setError
    );
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '18rem',
          '--header-height': 'calc(var(--spacing) * 12)'
        } as React.CSSProperties
      }
    >
      <AppSidebar activeCenter={activeCenter} onCenterSelect={setActiveCenter} variant="inset" />
      <SidebarInset>
        <SiteHeader title={getGatewayCenterTitle(activeCenter)} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <GatewayCenterPage
              center={activeCenter}
              data={data}
              error={error}
              isLoading={isLoading}
              management={
                remoteData
                  ? {
                      oneTimeApiKey,
                      onCreateApiKey: handleCreateApiKey,
                      onCreateModel: handleCreateModel,
                      onCreateProvider: handleCreateProvider,
                      onDeleteApiKey: handleDeleteApiKey,
                      onDeleteModel: handleDeleteModel,
                      onDeleteProvider: handleDeleteProvider,
                      onRevokeApiKey: handleRevokeApiKey,
                      onUpdateApiKey: handleUpdateApiKey,
                      onUpdateModel: handleUpdateModel,
                      onUpdateProvider: handleUpdateProvider
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
