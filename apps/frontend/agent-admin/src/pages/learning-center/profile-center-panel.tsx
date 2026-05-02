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
      setError(nextError instanceof Error ? nextError.message : '加载画像失败');
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
      setSuccess(`已更新画像：${profile.userId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新画像失败');
    } finally {
      setLoadingKey('');
    }
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">画像中枢</CardTitle>
        <Badge variant="outline">画像查询 / 修改</Badge>
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
              <Badge variant="outline">操作人 agent-admin-user</Badge>
              {profile.updatedAt ? <Badge variant="outline">更新时间 {profile.updatedAt}</Badge> : null}
            </div>
            <p className="mt-2">沟通风格：{profile.communicationStyle ?? '未设置'}</p>
            <p>执行风格：{profile.executionStyle ?? '未设置'}</p>
            <p>审批风格：{profile.approvalStyle ?? '未设置'}</p>
            <p>风险偏好：{profile.riskTolerance ?? '未设置'}</p>
            <p>编码偏好：{(profile.codingPreferences ?? []).join(', ') || '未设置'}</p>
            <p>禁止事项：{(profile.doNotDo ?? []).join(', ') || '未设置'}</p>
            <p>隐私标记：{(profile.privacyFlags ?? []).join(', ') || '未设置'}</p>
          </article>
        ) : null}
        {profile ? (
          <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
            <Input
              value={profileDraft.communicationStyle}
              onChange={event => setProfileDraft(current => ({ ...current, communicationStyle: event.target.value }))}
              placeholder="沟通风格"
            />
            <Input
              value={profileDraft.executionStyle}
              onChange={event => setProfileDraft(current => ({ ...current, executionStyle: event.target.value }))}
              placeholder="执行风格"
            />
            <Input
              value={profileDraft.approvalStyle}
              onChange={event => setProfileDraft(current => ({ ...current, approvalStyle: event.target.value }))}
              placeholder="审批风格"
            />
            <Input
              value={profileDraft.riskTolerance}
              onChange={event => setProfileDraft(current => ({ ...current, riskTolerance: event.target.value }))}
              placeholder="风险偏好"
            />
            <Input
              value={profileDraft.doNotDo}
              onChange={event => setProfileDraft(current => ({ ...current, doNotDo: event.target.value }))}
              placeholder="禁止事项（逗号分隔）"
            />
            <Input
              value={profileDraft.privacyFlags}
              onChange={event => setProfileDraft(current => ({ ...current, privacyFlags: event.target.value }))}
              placeholder="隐私标记（逗号分隔）"
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
