import { ApiOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';

import { useSettingsModelProviders } from '../../hooks/use-knowledge-governance';
import type { SettingsModelProvider } from '../../types/api';
import { RagOpsPage } from '../shared/ui';

const providerStatusLabel: Record<SettingsModelProvider['status'], string> = {
  connected: '已连接',
  disconnected: '未连接',
  error: '异常'
};

const providerStatusColor: Record<SettingsModelProvider['status'], string> = {
  connected: 'success',
  disconnected: 'default',
  error: 'error'
};

export function SettingsModelsPage() {
  const { loading, providers } = useSettingsModelProviders();

  return (
    <RagOpsPage
      extra={<Button icon={<PlusOutlined />}>添加提供商</Button>}
      eyebrow="Model Profiles"
      subTitle="配置 RAG 问答、重排、Embedding 和评测 Judge 使用的模型提供商。"
      title="模型配置"
    >
      <Row gutter={[16, 16]}>
        {providers.map(provider => (
          <Col key={provider.id} lg={8} md={12} xs={24}>
            <Card className="rag-ops-panel" loading={loading}>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space>
                    <ApiOutlined />
                    <Typography.Text strong>{provider.name}</Typography.Text>
                  </Space>
                  <Tag color={providerStatusColor[provider.status]}>{providerStatusLabel[provider.status]}</Tag>
                </Space>
                <Typography.Text type="secondary">{provider.models.length} 个可用模型</Typography.Text>
                <Space orientation="vertical" size={6}>
                  {provider.models.map(model => (
                    <Typography.Text key={model.id}>
                      <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                      {model.label}
                    </Typography.Text>
                  ))}
                </Space>
                <Button type="link">配置参数</Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </RagOpsPage>
  );
}
