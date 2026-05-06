import { useState } from 'react';

import { getMemoryHistory, getProfile, overrideMemory, patchProfile, rollbackMemory } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MemoryInsightCard } from './memory-insight-card';

export function MemoryGovernanceToolsCard() {
  const [userId, setUserId] = useState('');
  const [memoryId, setMemoryId] = useState('');
  const [loadingKey, setLoadingKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfile>>>();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getMemoryHistory>>>();
  const [profileDraft, setProfileDraft] = useState({
    communicationStyle: '',
    executionStyle: '',
    approvalStyle: '',
    riskTolerance: '',
    doNotDo: ''
  });
  const [overrideDraft, setOverrideDraft] = useState({
    summary: '',
    scopeType: 'user'
  });

  async function handleLoadProfile() {
    if (!userId.trim()) {
      return;
    }
    setLoadingKey('profile');
    setError('');
    setSuccess('');
    try {
      const loadedProfile = await getProfile(userId.trim());
      setProfile(loadedProfile);
      setProfileDraft({
        communicationStyle: loadedProfile?.communicationStyle ?? '',
        executionStyle: loadedProfile?.executionStyle ?? '',
        approvalStyle: loadedProfile?.approvalStyle ?? '',
        riskTolerance: loadedProfile?.riskTolerance ?? '',
        doNotDo: (loadedProfile?.doNotDo ?? []).join(', ')
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载 profile 失败');
    } finally {
      setLoadingKey('');
    }
  }

  async function handlePatchProfile() {
    if (!profile?.userId) {
      return;
    }
    setLoadingKey('patch-profile');
    setError('');
    setSuccess('');
    try {
      const patched = await patchProfile(profile.userId, {
        communicationStyle: profileDraft.communicationStyle || undefined,
        executionStyle: profileDraft.executionStyle || undefined,
        approvalStyle: profileDraft.approvalStyle || undefined,
        riskTolerance: profileDraft.riskTolerance || undefined,
        doNotDo: profileDraft.doNotDo
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
        actor: 'agent-admin-user'
      });
      setProfile(patched as Awaited<ReturnType<typeof getProfile>>);
      setSuccess(`已更新 profile：${profile.userId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新 profile 失败');
    } finally {
      setLoadingKey('');
    }
  }

  async function handleLoadHistory() {
    if (!memoryId.trim()) {
      return;
    }
    setLoadingKey('history');
    setError('');
    setSuccess('');
    try {
      const loadedHistory = await getMemoryHistory(memoryId.trim());
      setHistory(loadedHistory);
      setOverrideDraft({
        summary: loadedHistory.memory?.summary ?? '',
        scopeType: loadedHistory.memory?.scopeType ?? 'user'
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载 memory history 失败');
    } finally {
      setLoadingKey('');
    }
  }

  async function handleOverrideMemory() {
    if (!history?.memory?.id || !overrideDraft.summary.trim()) {
      return;
    }
    setLoadingKey('override-memory');
    setError('');
    setSuccess('');
    try {
      await overrideMemory(history.memory.id, {
        summary: overrideDraft.summary.trim(),
        content: overrideDraft.summary.trim(),
        reason: `admin override from governance tools for ${history.memory.id}`,
        actor: 'agent-admin-user',
        memoryType: history.memory.memoryType as
          | 'fact'
          | 'preference'
          | 'constraint'
          | 'procedure'
          | 'reflection'
          | 'summary'
          | 'skill-experience'
          | 'failure-pattern'
          | undefined,
        scopeType: overrideDraft.scopeType as 'session' | 'user' | 'task' | 'workspace' | 'team' | 'org' | 'global'
      });
      const refreshed = await getMemoryHistory(history.memory.id);
      setHistory(refreshed);
      setSuccess(`已覆写 memory：${history.memory.id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '覆写 memory 失败');
    } finally {
      setLoadingKey('');
    }
  }

  async function handleRollback(version: number) {
    if (!history?.memory?.id) {
      return;
    }
    setLoadingKey(`rollback:${version}`);
    setError('');
    setSuccess('');
    try {
      await rollbackMemory(history.memory.id, version, 'agent-admin-user');
      const refreshed = await getMemoryHistory(history.memory.id);
      setHistory(refreshed);
      setSuccess(`已回滚到 version ${version}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '回滚 memory 失败');
    } finally {
      setLoadingKey('');
    }
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Memory Governance Tools</CardTitle>
        <Badge variant="outline">profile / history</Badge>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-3">
          <p className="text-sm font-medium text-foreground">Profile Lookup</p>
          <div className="flex gap-2">
            <Input value={userId} onChange={event => setUserId(event.target.value)} placeholder="输入 user id" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleLoadProfile()}
              disabled={loadingKey === 'profile'}
            >
              查询画像
            </Button>
          </div>
          {profile ? (
            <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{profile.userId}</p>
              <p>communication: {profile.communicationStyle ?? 'n/a'}</p>
              <p>execution: {profile.executionStyle ?? 'n/a'}</p>
              <p>approval: {profile.approvalStyle ?? 'n/a'}</p>
              <p>risk: {profile.riskTolerance ?? 'n/a'}</p>
              <p>coding: {(profile.codingPreferences ?? []).join(', ') || 'n/a'}</p>
              <p>do not do: {(profile.doNotDo ?? []).join(', ') || 'n/a'}</p>
            </article>
          ) : null}
          {profile ? (
            <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
              <Input
                value={profileDraft.communicationStyle}
                onChange={event => setProfileDraft(current => ({ ...current, communicationStyle: event.target.value }))}
                placeholder="communication style"
              />
              <Input
                value={profileDraft.executionStyle}
                onChange={event => setProfileDraft(current => ({ ...current, executionStyle: event.target.value }))}
                placeholder="execution style"
              />
              <Input
                value={profileDraft.approvalStyle}
                onChange={event => setProfileDraft(current => ({ ...current, approvalStyle: event.target.value }))}
                placeholder="approval style"
              />
              <Input
                value={profileDraft.riskTolerance}
                onChange={event => setProfileDraft(current => ({ ...current, riskTolerance: event.target.value }))}
                placeholder="risk tolerance"
              />
              <Input
                value={profileDraft.doNotDo}
                onChange={event => setProfileDraft(current => ({ ...current, doNotDo: event.target.value }))}
                placeholder="do not do (comma separated)"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handlePatchProfile()}
                  disabled={loadingKey === 'patch-profile'}
                >
                  更新画像
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          <p className="text-sm font-medium text-foreground">Memory History Lookup</p>
          <div className="flex gap-2">
            <Input value={memoryId} onChange={event => setMemoryId(event.target.value)} placeholder="输入 memory id" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleLoadHistory()}
              disabled={loadingKey === 'history'}
            >
              查询历史
            </Button>
          </div>
          {history?.memory ? (
            <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
              <MemoryInsightCard data={history} eventLimit={5} />
              <div className="mt-3 grid gap-2">
                {history.events
                  .slice(-5)
                  .reverse()
                  .map(event => (
                    <div key={event.id} className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loadingKey === `rollback:${event.version}`}
                        onClick={() => void handleRollback(event.version)}
                      >
                        回滚到 version {event.version}
                      </Button>
                    </div>
                  ))}
              </div>
              <div className="mt-4 grid gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-3">
                <Input
                  value={overrideDraft.summary}
                  onChange={event => setOverrideDraft(current => ({ ...current, summary: event.target.value }))}
                  placeholder="replacement summary"
                />
                <Input
                  value={overrideDraft.scopeType}
                  onChange={event => setOverrideDraft(current => ({ ...current, scopeType: event.target.value }))}
                  placeholder="scope type"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingKey === 'override-memory'}
                    onClick={() => void handleOverrideMemory()}
                  >
                    覆写当前 memory
                  </Button>
                </div>
              </div>
            </article>
          ) : null}
        </section>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {success ? <p className="text-xs text-emerald-700">{success}</p> : null}
      </CardContent>
    </Card>
  );
}
