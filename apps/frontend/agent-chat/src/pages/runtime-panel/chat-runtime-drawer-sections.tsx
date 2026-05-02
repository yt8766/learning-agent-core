import { Card, Space, Typography } from 'antd';

const { Text } = Typography;

export function renderCompressionDetails(
  focuses?: string[],
  keyDeliverables?: string[],
  risks?: string[],
  nextActions?: string[],
  supportingFacts?: string[],
  previewMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
) {
  const sections = [
    { key: 'focuses', label: '一级重点', items: focuses },
    { key: 'deliverables', label: '关键交付', items: keyDeliverables },
    { key: 'risks', label: '风险与缺口', items: risks },
    { key: 'next-actions', label: '后续动作', items: nextActions },
    { key: 'facts', label: '补充事实', items: supportingFacts }
  ].filter(section => section.items?.length);

  return (
    <>
      {sections.map(section => (
        <Card key={section.key} size="small" title={section.label}>
          <Space orientation="vertical" size={6} style={{ width: '100%' }}>
            {section.items?.map(item => (
              <Text key={item}>{item}</Text>
            ))}
          </Space>
        </Card>
      ))}
      {previewMessages?.length ? (
        <Card size="small" title="折叠消息预览">
          <Space orientation="vertical" size={6} style={{ width: '100%' }}>
            {previewMessages.map((item, index) => (
              <Text key={`${item.role}-${index}`} type="secondary">
                {item.role}: {item.content}
              </Text>
            ))}
          </Space>
        </Card>
      ) : null}
    </>
  );
}
