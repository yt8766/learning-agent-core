import { Button, Input, Radio, Space, Tag } from 'antd';
import { useState } from 'react';

import { getPlanQuestionTypeLabel, type PlanQuestionCardData } from './card-meta';

interface PlanQuestionCardProps {
  card: PlanQuestionCardData;
  onAction?: (params: {
    action: 'input' | 'bypass' | 'abort';
    interruptId?: string;
    answers?: Array<{
      questionId: string;
      optionId?: string;
      freeform?: string;
    }>;
  }) => void;
}

export function PlanQuestionCard(props: PlanQuestionCardProps) {
  const { card, onAction } = props;
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [freeformAnswers, setFreeformAnswers] = useState<Record<string, string>>({});

  const submitAnswers = () => {
    onAction?.({
      action: 'input',
      interruptId: card.interruptId,
      answers: card.questions.map(question => ({
        questionId: question.id,
        optionId: selectedOptions[question.id] || question.recommendedOptionId,
        freeform: freeformAnswers[question.id]?.trim() || undefined
      }))
    });
  };

  const isLocked = card.status && card.status !== 'pending';

  return (
    <div className="chatx-approval-card chatx-plan-card">
      <div className="chatx-approval-card__header">
        <div className="chatx-approval-card__title-wrap">
          <div className="chatx-approval-card__eyebrow">计划问题</div>
          <div className="chatx-approval-card__title">{card.title}</div>
        </div>
        <Tag color={card.status === 'bypassed' ? 'orange' : card.status === 'aborted' ? 'red' : 'blue'}>
          {card.status === 'answered'
            ? '已回答'
            : card.status === 'bypassed'
              ? '已跳过'
              : card.status === 'aborted'
                ? '已取消'
                : '等待方案澄清'}
        </Tag>
      </div>

      {card.summary ? <div className="chatx-approval-card__summary">{card.summary}</div> : null}

      <div className="chatx-plan-card__questions">
        {card.questions.map(question => (
          <div key={question.id} className="chatx-plan-card__question">
            <div className="chatx-plan-card__question-header">
              <strong>{question.question}</strong>
              <Tag color="geekblue">{getPlanQuestionTypeLabel(question.questionType)}</Tag>
            </div>
            {question.whyAsked ? <p className="chatx-plan-card__meta">为什么要问：{question.whyAsked}</p> : null}
            <Radio.Group
              disabled={isLocked}
              value={selectedOptions[question.id]}
              onChange={event =>
                setSelectedOptions(current => ({
                  ...current,
                  [question.id]: event.target.value
                }))
              }
            >
              <Space orientation="vertical">
                {question.options.map(option => (
                  <Radio key={option.id} value={option.id}>
                    <span>{option.label}</span>
                    <span className="chatx-plan-card__option-description">{option.description}</span>
                    {question.recommendedOptionId === option.id ? <Tag color="green">推荐</Tag> : null}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
            {question.allowFreeform ? (
              <Input.TextArea
                disabled={isLocked}
                value={freeformAnswers[question.id] ?? ''}
                rows={2}
                placeholder={question.defaultAssumption ?? '可补充你的偏好或约束'}
                onChange={event =>
                  setFreeformAnswers(current => ({
                    ...current,
                    [question.id]: event.target.value
                  }))
                }
              />
            ) : null}
            {question.defaultAssumption ? (
              <p className="chatx-plan-card__meta">默认假设：{question.defaultAssumption}</p>
            ) : null}
          </div>
        ))}
      </div>

      {!isLocked ? (
        <div className="chatx-approval-card__actions">
          <Button type="primary" onClick={submitAnswers}>
            提交回答
          </Button>
          <Button onClick={() => onAction?.({ action: 'bypass', interruptId: card.interruptId })}>
            跳过计划，按推荐项继续
          </Button>
          <Button danger onClick={() => onAction?.({ action: 'abort', interruptId: card.interruptId })}>
            取消任务
          </Button>
        </div>
      ) : null}
    </div>
  );
}
