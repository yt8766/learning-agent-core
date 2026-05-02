import { Card, Form, Input, Select, Switch } from 'antd';

import { PageSection } from '../shared/ui';

export function SettingsPage() {
  return (
    <PageSection subTitle="默认检索链路、向量库和治理策略" title="设置">
      <Card>
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
    </PageSection>
  );
}
