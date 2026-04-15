import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const planCardTestState = vi.hoisted(() => ({
  stateQueue: [] as Array<{ value: unknown; setter?: (...args: unknown[]) => void }>,
  autoClickLabels: new Set<string>(),
  autoTriggerOptionChange: false,
  autoTriggerFreeformChange: false
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: ((initialValue: unknown) => {
      const next = planCardTestState.stateQueue.shift();
      return [next?.value ?? initialValue, next?.setter ?? vi.fn()];
    }) as typeof actual.useState
  };
});

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
    danger,
    type
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
    type?: string;
  }) => {
    const text = React.Children.toArray(children).join('');
    if (planCardTestState.autoClickLabels.has(text)) {
      onClick?.();
    }
    return (
      <button data-danger={danger ? 'true' : 'false'} data-kind={type ?? 'default'} type="button">
        {children}
      </button>
    );
  },
  Input: {
    TextArea: ({
      disabled,
      value,
      rows,
      placeholder,
      onChange
    }: {
      disabled?: boolean;
      value?: string;
      rows?: number;
      placeholder?: string;
      onChange?: (event: { target: { value: string } }) => void;
    }) => (
      <textarea
        data-rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        readOnly
        value={value}
        {...(!disabled && planCardTestState.autoTriggerFreeformChange
          ? { 'data-triggered': (onChange?.({ target: { value: 'backend note' } }), 'true') }
          : {})}
      />
    )
  },
  Radio: Object.assign(
    ({ children, value }: { children?: React.ReactNode; value?: string }) => (
      <label data-option-value={value}>{children}</label>
    ),
    {
      Group: ({
        children,
        disabled,
        value,
        onChange
      }: {
        children?: React.ReactNode;
        disabled?: boolean;
        value?: string;
        onChange?: (event: { target: { value: string } }) => void;
      }) => {
        if (!disabled && planCardTestState.autoTriggerOptionChange) {
          onChange?.({ target: { value: 'backend' } });
        }
        return (
          <div data-disabled={disabled ? 'true' : 'false'} data-selected-value={value ?? ''}>
            {children}
          </div>
        );
      }
    }
  ),
  Space: ({ children, direction }: { children?: React.ReactNode; direction?: string }) => (
    <div data-direction={direction}>{children}</div>
  ),
  Tag: ({ children, color }: { children?: React.ReactNode; color?: string }) => (
    <span data-color={color}>{children}</span>
  )
}));

import { PlanQuestionCard } from '@/components/chat-message-cards/plan-question-card';

function resetHarness() {
  planCardTestState.stateQueue.length = 0;
  planCardTestState.autoClickLabels.clear();
  planCardTestState.autoTriggerOptionChange = false;
  planCardTestState.autoTriggerFreeformChange = false;
}

afterEach(() => {
  resetHarness();
  vi.clearAllMocks();
});

describe('PlanQuestionCard', () => {
  it('submits selected and recommended answers with trimmed freeform text', () => {
    const onAction = vi.fn();
    const setSelectedOptions = vi.fn();
    const setFreeformAnswers = vi.fn();
    planCardTestState.stateQueue.push(
      { value: { scope: 'backend' }, setter: setSelectedOptions },
      { value: { scope: '  继续补前端和 backend 交界  ' }, setter: setFreeformAnswers }
    );
    planCardTestState.autoClickLabels.add('提交回答');
    planCardTestState.autoTriggerOptionChange = true;
    planCardTestState.autoTriggerFreeformChange = true;

    renderToStaticMarkup(
      <PlanQuestionCard
        card={
          {
            interruptId: 'interrupt-1',
            title: '需要补充计划边界',
            summary: '请先确认这轮实现边界。',
            status: 'pending',
            questions: [
              {
                id: 'scope',
                question: '这轮优先覆盖哪里？',
                questionType: 'detail',
                whyAsked: '避免盲目扩散。',
                recommendedOptionId: 'runtime-host',
                allowFreeform: true,
                defaultAssumption: '默认先做 runtime-host',
                options: [
                  { id: 'runtime-host', label: 'runtime-host', description: '优先清主短板' },
                  { id: 'backend', label: 'backend', description: '先补 backend wrapper' }
                ]
              },
              {
                id: 'risk',
                question: '是否接受局部 helper 拆分？',
                questionType: 'tradeoff',
                recommendedOptionId: 'yes',
                options: [
                  { id: 'yes', label: '接受', description: '只做内部 helper 收敛' },
                  { id: 'no', label: '不接受', description: '保持原样结构' }
                ]
              }
            ]
          } as any
        }
        onAction={onAction}
      />
    );

    expect(onAction).toHaveBeenCalledWith({
      action: 'input',
      interruptId: 'interrupt-1',
      answers: [
        {
          questionId: 'scope',
          optionId: 'backend',
          freeform: '继续补前端和 backend 交界'
        },
        {
          questionId: 'risk',
          optionId: 'yes',
          freeform: undefined
        }
      ]
    });
    expect(setSelectedOptions).toHaveBeenCalled();
    expect(setFreeformAnswers).toHaveBeenCalled();
    expect(setSelectedOptions.mock.calls[0]?.[0]({ previous: 'value' })).toEqual({
      previous: 'value',
      scope: 'backend'
    });
    expect(setFreeformAnswers.mock.calls[0]?.[0]({ note: 'old' })).toEqual({
      note: 'old',
      scope: 'backend note'
    });
  });

  it('supports bypass and abort actions for pending cards', () => {
    const onAction = vi.fn();
    planCardTestState.stateQueue.push({ value: {} }, { value: {} });
    planCardTestState.autoClickLabels.add('跳过计划，按推荐项继续');
    planCardTestState.autoClickLabels.add('取消任务');

    renderToStaticMarkup(
      <PlanQuestionCard
        card={
          {
            interruptId: 'interrupt-2',
            title: '继续当前计划',
            status: 'pending',
            questions: [
              {
                id: 'delivery',
                question: '是否继续推进？',
                questionType: 'direction',
                options: [{ id: 'yes', label: '继续', description: '继续执行当前计划' }]
              }
            ]
          } as any
        }
        onAction={onAction}
      />
    );

    expect(onAction).toHaveBeenNthCalledWith(1, { action: 'bypass', interruptId: 'interrupt-2' });
    expect(onAction).toHaveBeenNthCalledWith(2, { action: 'abort', interruptId: 'interrupt-2' });
  });

  it('renders locked cards without action buttons and with disabled inputs', () => {
    planCardTestState.stateQueue.push({ value: {} }, { value: {} }, { value: {} }, { value: { aborted: '原因补充' } });

    const html = renderToStaticMarkup(
      <div>
        <PlanQuestionCard
          card={
            {
              interruptId: 'interrupt-3',
              title: '已跳过',
              status: 'bypassed',
              questions: [
                {
                  id: 'scope',
                  question: '这轮优先覆盖哪里？',
                  questionType: 'direction',
                  options: [{ id: 'runtime-host', label: 'runtime-host', description: '优先清主短板' }]
                }
              ]
            } as any
          }
        />
        <PlanQuestionCard
          card={
            {
              interruptId: 'interrupt-4',
              title: '已取消',
              status: 'aborted',
              questions: [
                {
                  id: 'aborted',
                  question: '补充取消原因？',
                  questionType: 'detail',
                  allowFreeform: true,
                  options: [{ id: 'backend', label: 'backend', description: '先补 backend wrapper' }]
                }
              ]
            } as any
          }
        />
      </div>
    );

    expect(html).toContain('已跳过');
    expect(html).toContain('已取消');
    expect(html).not.toContain('提交回答');
    expect(html).toContain('disabled=""');
  });

  it('renders answered cards with the answered tag and empty freeform fallback', () => {
    planCardTestState.stateQueue.push({ value: {} }, { value: {} });

    const html = renderToStaticMarkup(
      <PlanQuestionCard
        card={
          {
            interruptId: 'interrupt-5',
            title: '已回答问题',
            status: 'answered',
            questions: [
              {
                id: 'scope',
                question: '继续推进哪一块？',
                questionType: 'detail',
                allowFreeform: true,
                options: [{ id: 'runtime-host', label: 'runtime-host', description: '继续 runtime-host' }]
              }
            ]
          } as any
        }
      />
    );

    expect(html).toContain('已回答');
    expect(html).toContain('<textarea');
    expect(html).toContain('value=""');
  });
});
