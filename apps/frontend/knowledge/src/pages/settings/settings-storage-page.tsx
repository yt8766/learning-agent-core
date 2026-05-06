import { CloudServerOutlined, DatabaseOutlined, HddOutlined } from '@ant-design/icons';
import { Card, Descriptions, Progress, Space, Statistic, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';

import { useSettingsStorage } from '../../hooks/use-knowledge-governance';
import type { SettingsStorageOverview } from '../../types/api';
import { RagOpsPage } from '../shared/ui';

type StorageKnowledgeBase = SettingsStorageOverview['knowledgeBases'][number];

const bucketIcon: Record<string, ReactNode> = {
  backups: <CloudServerOutlined />,
  documents: <DatabaseOutlined />,
  media: <HddOutlined />,
  vectors: <DatabaseOutlined />
};

const columns: ColumnsType<StorageKnowledgeBase> = [
  { title: '知识库', dataIndex: 'name' },
  { title: '文档数', dataIndex: 'documentCount' },
  {
    title: '占用',
    dataIndex: 'storageUsed',
    render: (value, row) => `${value} ${row.storageUnit}`
  },
  { title: '向量索引', dataIndex: 'vectorIndexSize' },
  {
    title: '最近备份',
    dataIndex: 'lastBackupAt',
    render: value => formatTime(value as string)
  }
];

export function SettingsStoragePage() {
  const { loading, storage } = useSettingsStorage();

  return (
    <RagOpsPage eyebrow="Storage Budget" subTitle="查看向量索引、对象存储、文档缓存和备份容量。" title="存储管理">
      <div className="knowledge-pro-card-grid">
        {storage.buckets.map(bucket => (
          <Card key={bucket.id} loading={loading}>
            <Statistic prefix={bucketIcon[bucket.id]} suffix={bucket.unit} title={bucket.label} value={bucket.used} />
            <Progress percent={Math.round((bucket.used / bucket.total) * 100)} />
          </Card>
        ))}
      </div>
      <Card className="rag-ops-table-card" title="知识空间容量明细">
        <Table columns={columns} dataSource={storage.knowledgeBases} loading={loading} pagination={false} rowKey="id" />
      </Card>
      <Card className="rag-ops-panel" title="存储后端">
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="向量存储">PostgreSQL + pgvector</Descriptions.Item>
            <Descriptions.Item label="对象存储">OSS knowledge-documents bucket</Descriptions.Item>
            <Descriptions.Item label="缓存策略">解析结果保留 30 天，失败任务保留审计记录</Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>
    </RagOpsPage>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit'
  }).format(new Date(value));
}
