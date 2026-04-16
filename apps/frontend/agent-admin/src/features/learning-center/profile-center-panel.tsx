import { useState } from 'react';

import { getProfile, patchProfile } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ProfileCenterPanel() {
  const [userId, setUserId] = useState('');
  const [loadingKey, setLoadingKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfile>>>();
  const [profileDraft, setProfileDraft] = useState({
    communicationStyle: '',
    executionStyle: '',
    approvalStyle: '',
    riskTolerance: '',
    doNotDo: '',
    privacyFlags: ''
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
        doNotDo: (loadedProfile?.doNotDo ?? []).join(', '),
        privacyFlags: (loadedProfile?.privacyFlags ?? []).join(', ')
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
        privacyFlags: profileDraft.privacyFlags
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

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Profile Center</CardTitle>
        <Badge variant="outline">profile lookup / patch</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
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
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {success ? <p className="text-xs text-emerald-700">{success}</p> : null}
        {profile ? (
          <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{profile.userId}</Badge>
              <Badge variant="outline">actor agent-admin-user</Badge>
              {profile.updatedAt ? <Badge variant="outline">updated {profile.updatedAt}</Badge> : null}
            </div>
            <p className="mt-2">communication: {profile.communicationStyle ?? 'n/a'}</p>
            <p>execution: {profile.executionStyle ?? 'n/a'}</p>
            <p>approval: {profile.approvalStyle ?? 'n/a'}</p>
            <p>risk: {profile.riskTolerance ?? 'n/a'}</p>
            <p>coding: {(profile.codingPreferences ?? []).join(', ') || 'n/a'}</p>
            <p>do not do: {(profile.doNotDo ?? []).join(', ') || 'n/a'}</p>
            <p>privacy flags: {(profile.privacyFlags ?? []).join(', ') || 'n/a'}</p>
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
            <Input
              value={profileDraft.privacyFlags}
              onChange={event => setProfileDraft(current => ({ ...current, privacyFlags: event.target.value }))}
              placeholder="privacy flags (comma separated)"
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
      </CardContent>
    </Card>
  );
}
