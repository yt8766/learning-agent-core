import { describe, expect, it } from 'vitest';

import { interpretApprovalReply } from '../../src/chat/approval-reply-interpreter';

describe('interpretApprovalReply', () => {
  it('interprets medium-risk confirmation phrases as approval', () => {
    expect(
      interpretApprovalReply({
        interactionId: 'interaction-1',
        text: '确认执行',
        expectedActions: ['approve', 'reject', 'feedback'],
        requiredConfirmationPhrase: '确认执行'
      })
    ).toMatchObject({
      action: 'approve',
      confidence: 'high',
      matchedConfirmationPhrase: '确认执行'
    });

    expect(
      interpretApprovalReply({
        interactionId: 'interaction-1',
        text: '继续',
        expectedActions: ['approve', 'reject', 'feedback']
      })
    ).toMatchObject({
      action: 'approve',
      confidence: 'high'
    });
  });

  it('interprets cancellation phrases as rejection', () => {
    expect(
      interpretApprovalReply({
        interactionId: 'interaction-1',
        text: '取消，别执行',
        expectedActions: ['approve', 'reject', 'feedback']
      })
    ).toMatchObject({
      action: 'reject',
      confidence: 'high'
    });
  });

  it('interprets conditional confirmation as feedback', () => {
    expect(
      interpretApprovalReply({
        interactionId: 'interaction-1',
        text: '可以，但不要删除文件',
        expectedActions: ['approve', 'reject', 'feedback']
      })
    ).toMatchObject({
      action: 'feedback',
      confidence: 'high',
      feedback: '可以，但不要删除文件'
    });
  });

  it('requires exact high-risk confirmation phrases', () => {
    expect(
      interpretApprovalReply({
        interactionId: 'interaction-1',
        text: '确认',
        expectedActions: ['approve', 'reject', 'feedback'],
        requiredConfirmationPhrase: '确认推送'
      })
    ).toMatchObject({
      action: 'unknown',
      confidence: 'low'
    });

    expect(
      interpretApprovalReply({
        interactionId: 'interaction-1',
        text: '确认推送',
        expectedActions: ['approve', 'reject', 'feedback'],
        requiredConfirmationPhrase: '确认推送'
      })
    ).toMatchObject({
      action: 'approve',
      confidence: 'high',
      matchedConfirmationPhrase: '确认推送'
    });
  });
});
