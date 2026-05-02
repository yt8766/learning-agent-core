import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { CompanyLiveGenerateBrief } from '@/api/company-live.api';

interface CompanyLiveGenerateFormProps {
  onSubmit: (brief: CompanyLiveGenerateBrief) => void;
  loading?: boolean;
}

export function CompanyLiveGenerateForm({ onSubmit, loading }: CompanyLiveGenerateFormProps) {
  const [briefId, setBriefId] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('douyin');
  const [script, setScript] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [speakerVoiceId, setSpeakerVoiceId] = useState('voice-default');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!briefId.trim() || !script.trim()) return;
    onSubmit({
      briefId: briefId.trim(),
      targetPlatform,
      script: script.trim(),
      durationSeconds,
      speakerVoiceId: speakerVoiceId.trim() || 'voice-default'
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-briefId">
          Brief ID
        </label>
        <Input
          id="cl-briefId"
          placeholder="brief-001"
          value={briefId}
          onChange={e => setBriefId(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-platform">
          目标平台
        </label>
        <Input
          id="cl-platform"
          placeholder="douyin / bilibili / wechat-video"
          value={targetPlatform}
          onChange={e => setTargetPlatform(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-script">
          脚本内容
        </label>
        <textarea
          id="cl-script"
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="请输入直播脚本..."
          value={script}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScript(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-duration">
            时长（秒）
          </label>
          <Input
            id="cl-duration"
            type="number"
            min={10}
            max={3600}
            value={durationSeconds}
            onChange={e => setDurationSeconds(Number(e.target.value))}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-voice">
            Voice ID
          </label>
          <Input
            id="cl-voice"
            placeholder="voice-default"
            value={speakerVoiceId}
            onChange={e => setSpeakerVoiceId(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? '生成中…' : '生成直播内容'}
      </Button>
    </form>
  );
}
