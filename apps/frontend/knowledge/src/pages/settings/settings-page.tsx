import { Card, Form, Input, Select, Switch } from 'antd';

import { LifecycleRail, RagOpsPage, type LifecycleStep } from '../shared/ui';

const settingsLifecycle: LifecycleStep[] = [
  {
    description: 'Embedding、Chat、Rerank 和 Judge 模型必须通过稳定 profile 暴露。',
    key: 'models',
    metric: '模型配置',
    status: 'running',
    title: '模型'
  },
  {
    description: 'API Key 和连接凭据只在服务端使用，前端展示 masked projection。',
    key: 'keys',
    metric: 'API 密钥',
    status: 'healthy',
    title: '凭据'
  },
  {
    description: '对象存储、向量索引和备份容量共同决定知识空间预算。',
    key: 'storage',
    metric: '存储管理',
    status: 'warning',
    title: '存储'
  },
  {
    description: '高风险知识变更、权限越界和审计策略进入审批门。',
    key: 'security',
    metric: '安全策略',
    status: 'healthy',
    title: '安全'
  }
];

export function SettingsPage() {
  return (
    <RagOpsPage
      eyebrow="System Policy"
      subTitle="统一配置默认检索链路、模型 profile、密钥、存储和安全策略。"
      title="系统策略"
    >
      <Card className="rag-ops-panel" title="策略分区">
        <LifecycleRail steps={settingsLifecycle} />
      </Card>
      <Card className="rag-ops-panel" title="默认 RAG 策略">
        <Form layout="vertical">
          <Form.Item label="默认向量库">
            <Select
              defaultValue="pgvector"
              options={[
                { label: 'Supabase PostgreSQL + pgvector', value: 'pgvector' },
                { label: 'Chroma', value: 'chroma' }
              ]}
            />
          </Form.Item>
          <Form.Item label="Embedding Provider">
            <Input defaultValue="Project EmbeddingProvider facade" />
          </Form.Item>
          <Form.Item label="高风险知识变更审批">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Card>
    </RagOpsPage>
  );
}
