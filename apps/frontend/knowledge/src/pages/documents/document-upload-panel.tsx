import { useRef } from 'react';
import { Alert, Button, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { InboxOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';

import { useDocumentUpload } from '../../hooks/use-document-upload';

export function DocumentUploadPanel({
  knowledgeBaseId,
  onUploaded
}: {
  knowledgeBaseId: string;
  onUploaded?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const upload = useDocumentUpload({ knowledgeBaseId });
  const busy = upload.status === 'uploading' || upload.status === 'creating' || upload.status === 'polling';

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    void upload.upload(file).then(() => {
      onUploaded?.();
    });
    event.currentTarget.value = '';
  }

  return (
    <Card
      title={
        <Space>
          <InboxOutlined />
          <span>上传文档</span>
        </Space>
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <input
          ref={fileInputRef}
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          aria-label="选择 Markdown 或 TXT 文档"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          type="file"
        />
        <Space>
          <Button icon={<UploadOutlined />} loading={busy} onClick={() => fileInputRef.current?.click()} type="primary">
            选择 Markdown/TXT
          </Button>
          <Button disabled={busy && upload.status !== 'failed'} icon={<ReloadOutlined />} onClick={upload.reset}>
            重置
          </Button>
          <Tag>{upload.status}</Tag>
        </Space>
        {upload.error ? <Alert message={upload.error.message} type="error" /> : null}
        {upload.uploadResult ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="文件名">{upload.uploadResult.filename}</Descriptions.Item>
            <Descriptions.Item label="大小">{upload.uploadResult.size}</Descriptions.Item>
            <Descriptions.Item label="Object Key">{upload.uploadResult.objectKey}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">仅支持 Markdown 与 TXT 文件。</Typography.Text>
        )}
        {upload.job ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Job">{upload.job.id}</Descriptions.Item>
            <Descriptions.Item label="状态">{upload.job.status}</Descriptions.Item>
            <Descriptions.Item label="Stage">{upload.job.currentStage ?? '-'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Space>
    </Card>
  );
}
