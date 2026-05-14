import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Modal, Popover } from 'antd';

import { chatApi } from '../api/chat-api';
import type { ChatModelOption } from '../types/chat';
import {
  ArrowUpIcon,
  BrainIcon,
  CheckIcon,
  EyeIcon,
  PaperclipIcon,
  SearchIcon,
  StopIcon,
  ToolIcon
} from './chatbot-icons';
import {
  filterComposerModels,
  getModelLogoSrc,
  readComposerDraft,
  shouldSubmitComposerKey,
  writeComposerDraft
} from './codex-composer.helpers';

const fallbackModels: ChatModelOption[] = [
  { id: 'deepseek-ai/deepseek-v3.2', displayName: 'DeepSeek V3.2', providerId: 'deepseek' },
  { id: 'mistralai/codestral', displayName: 'Codestral', providerId: 'mistralai' },
  { id: 'mistralai/mistral-small', displayName: 'Mistral Small', providerId: 'mistralai' },
  { id: 'moonshotai/kimi-k2.5', displayName: 'Kimi K2.5', providerId: 'moonshotai' },
  { id: 'openai/gpt-oss-20b', displayName: 'GPT OSS 20B', providerId: 'openai' },
  { id: 'openai/gpt-oss-120b', displayName: 'GPT OSS 120B', providerId: 'openai' },
  { id: 'x-ai/grok-4.1-fast', displayName: 'Grok 4.1 Fast', providerId: 'x-ai' }
];

const fallbackModel: ChatModelOption = fallbackModels[3] ?? fallbackModels[0]!;

function getBrowserStorage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

interface CodexComposerProps {
  isRequesting: boolean;
  onCancel: () => void;
  onSubmit: (content: string, modelId?: string) => void;
  streamError?: string;
}

export function CodexComposer({ isRequesting, onCancel, onSubmit, streamError }: CodexComposerProps) {
  const [value, setValue] = useState(() => readComposerDraft(getBrowserStorage()));
  const [isComposing, setIsComposing] = useState(false);
  const [models, setModels] = useState<ChatModelOption[]>(fallbackModels);
  const [selectedModelId, setSelectedModelId] = useState(fallbackModel.id);
  const [modelSearch, setModelSearch] = useState('');
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  useEffect(() => {
    writeComposerDraft(getBrowserStorage(), value);
  }, [value]);

  useEffect(() => {
    let disposed = false;

    void chatApi
      .listModels()
      .then(records => {
        if (disposed || records.length === 0) {
          return;
        }
        setModels(records);
        setSelectedModelId(current =>
          records.some(model => model.id === current) ? current : (records[0]?.id ?? current)
        );
      })
      .catch(() => {
        if (!disposed) {
          setModels(fallbackModels);
          setSelectedModelId(fallbackModel.id);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  const selectedModel = models.find(model => model.id === selectedModelId) ?? fallbackModel;
  const visibleModels = useMemo(() => filterComposerModels(models, modelSearch), [modelSearch, models]);
  const selectedModelLogoSrc = getModelLogoSrc(selectedModel);

  const submitComposer = () => {
    const content = value.trim();
    if (!content || isRequesting) {
      return;
    }

    setValue('');
    onSubmit(content, selectedModel.id);
  };

  const modelSelectorContent = (
    <div className="chatbot-model-popover" role="dialog" aria-label="选择模型">
      <label className="chatbot-model-search">
        <SearchIcon />
        <input
          value={modelSearch}
          onChange={event => setModelSearch(event.target.value)}
          placeholder="Search models..."
        />
      </label>
      <span className="chatbot-model-section-label">Available</span>
      <div className="chatbot-model-list">
        {visibleModels.map(model => (
          <button
            key={model.id}
            type="button"
            className={`chatbot-model-option${model.id === selectedModel.id ? ' chatbot-model-option-active' : ''}`}
            onClick={() => {
              setSelectedModelId(model.id);
              setModelSelectorOpen(false);
            }}
          >
            <img
              alt=""
              aria-hidden="true"
              className="chatbot-model-option-logo"
              height={18}
              src={getModelLogoSrc(model)}
              width={18}
            />
            <span className="chatbot-model-option-name">{model.displayName}</span>
            <span className="chatbot-model-capabilities" aria-hidden="true">
              <ToolIcon />
              <EyeIcon />
              <BrainIcon />
            </span>
            {model.id === selectedModel.id && <CheckIcon className="chatbot-model-selected-check" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <footer className="chatbot-composer-wrap">
      {streamError ? <p className="chatbot-stream-error">{streamError}</p> : null}
      <form
        className="chatbot-composer"
        onSubmit={event => {
          event.preventDefault();
          submitComposer();
        }}
      >
        <textarea
          className="chatbot-composer-textarea"
          value={value}
          onChange={event => setValue(event.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (
              shouldSubmitComposerKey({
                key: event.key,
                shiftKey: event.shiftKey,
                isComposing,
                nativeIsComposing: event.nativeEvent.isComposing
              })
            ) {
              event.preventDefault();
              submitComposer();
            }
          }}
          placeholder="Ask anything..."
          rows={3}
        />
        <div className="chatbot-composer-footer">
          <div className="chatbot-composer-tools">
            <button
              type="button"
              className="chatbot-composer-attachment"
              aria-label="添加附件"
              onClick={() =>
                Modal.info({
                  title: '附件上传尚未接入',
                  content: '当前后端还没有消息附件协议，暂不启用前端本地附件预览。',
                  okText: '知道了'
                })
              }
            >
              <PaperclipIcon />
            </button>
            <Popover
              arrow={false}
              content={modelSelectorContent}
              open={modelSelectorOpen}
              placement="topLeft"
              trigger="click"
              onOpenChange={setModelSelectorOpen}
              classNames={{ root: 'chatbot-model-selector-overlay' }}
            >
              <button
                type="button"
                className="chatbot-model-selector"
                aria-label={`当前模型：${selectedModel.displayName}`}
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="chatbot-model-mark"
                  height={18}
                  src={selectedModelLogoSrc}
                  width={18}
                />
                <span>{selectedModel.displayName}</span>
              </button>
            </Popover>
          </div>
          <button
            type={isRequesting ? 'button' : 'submit'}
            className="chatbot-composer-submit"
            aria-label={isRequesting ? '停止回答' : '发送消息'}
            disabled={!isRequesting && !value.trim()}
            onClick={isRequesting ? onCancel : undefined}
          >
            {isRequesting ? <StopIcon /> : <ArrowUpIcon />}
          </button>
        </div>
      </form>
    </footer>
  );
}
