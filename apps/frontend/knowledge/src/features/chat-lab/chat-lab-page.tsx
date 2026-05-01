import { useState } from 'react';

import { MockKnowledgeApiClient } from '../../api/mock-knowledge-api-client';
import type { ChatResponse } from '../../types/api';
import { DataCard, PageSection, styles } from '../shared/ui';

const client = new MockKnowledgeApiClient();

export function ChatLabPage() {
  const [question, setQuestion] = useState('动态导入有什么限制？');
  const [response, setResponse] = useState<ChatResponse | undefined>();

  return (
    <PageSection title="对话实验室">
      <DataCard>
        <textarea onChange={event => setQuestion(event.target.value)} style={textareaStyle} value={question} />
        <button
          onClick={async () =>
            setResponse(await client.chat({ knowledgeBaseIds: ['kb_frontend'], message: question, debug: true }))
          }
          style={buttonStyle}
          type="button"
        >
          发送
        </button>
      </DataCard>
      {response ? (
        <DataCard>
          <strong>回答</strong>
          <p>{response.answer}</p>
          <p style={styles.muted}>Trace: {response.traceId}</p>
          <p style={styles.muted}>引用: {response.citations.map(item => item.title).join(', ')}</p>
        </DataCard>
      ) : null}
    </PageSection>
  );
}

const textareaStyle = {
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  font: 'inherit',
  minHeight: 96,
  padding: 12,
  resize: 'vertical'
} as const;

const buttonStyle = {
  background: '#175cd3',
  border: 0,
  borderRadius: 8,
  color: '#ffffff',
  cursor: 'pointer',
  justifySelf: 'start',
  padding: '10px 14px'
} as const;
