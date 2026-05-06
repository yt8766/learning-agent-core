import { useState, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { CompanyLiveExpertConsultRequest } from '@/api/company-live.api';

interface CompanyLiveExpertConsultFormProps {
  onSubmit: (input: CompanyLiveExpertConsultRequest) => void;
  loading?: boolean;
}

export function CompanyLiveExpertConsultForm({ onSubmit, loading }: CompanyLiveExpertConsultFormProps) {
  const [question, setQuestion] = useState('');
  const [briefId, setBriefId] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('douyin');
  const [script, setScript] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('60');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [speakerVoiceId, setSpeakerVoiceId] = useState('voice-default');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!question.trim() || !briefId.trim() || !script.trim()) return;

    const trimmedDuration = durationSeconds.trim();
    if (!/^\d+$/.test(trimmedDuration)) {
      setDurationError('请输入 10 到 3600 之间的整数秒数。');
      return;
    }

    const parsedDurationSeconds = Number.parseInt(trimmedDuration, 10);
    if (parsedDurationSeconds < 10 || parsedDurationSeconds > 3600) {
      setDurationError('请输入 10 到 3600 之间的整数秒数。');
      return;
    }

    setDurationError(null);
    onSubmit({
      question: question.trim(),
      brief: {
        briefId: briefId.trim(),
        targetPlatform: targetPlatform.trim() || 'douyin',
        script: script.trim(),
        durationSeconds: parsedDurationSeconds,
        speakerVoiceId: speakerVoiceId.trim() || 'voice-default'
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-consult-question">
          会诊问题
        </label>
        <textarea
          id="cl-consult-question"
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="例如：这段直播开场如何提高停留和转化？"
          value={question}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQuestion(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-consult-briefId">
          Brief ID
        </label>
        <Input
          id="cl-consult-briefId"
          placeholder="brief-001"
          value={briefId}
          onChange={e => setBriefId(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-consult-platform">
          目标平台
        </label>
        <Input
          id="cl-consult-platform"
          placeholder="douyin / bilibili / wechat-video"
          value={targetPlatform}
          onChange={e => setTargetPlatform(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-consult-script">
          脚本内容
        </label>
        <textarea
          id="cl-consult-script"
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="请输入需要专家会诊的直播脚本..."
          value={script}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setScript(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-consult-duration">
            时长（秒）
          </label>
          <Input
            id="cl-consult-duration"
            type="number"
            min={10}
            max={3600}
            value={durationSeconds}
            onChange={e => {
              setDurationSeconds(e.target.value);
              if (durationError) setDurationError(null);
            }}
            aria-invalid={durationError ? 'true' : undefined}
            aria-describedby={durationError ? 'cl-consult-duration-error' : undefined}
          />
          {durationError ? (
            <p id="cl-consult-duration-error" className="text-xs text-destructive">
              {durationError}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="cl-consult-voice">
            Voice ID
          </label>
          <Input
            id="cl-consult-voice"
            placeholder="voice-default"
            value={speakerVoiceId}
            onChange={e => setSpeakerVoiceId(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full whitespace-normal text-center leading-tight">
        {loading ? '会诊中...' : '发起专家会诊'}
      </Button>
    </form>
  );
}
