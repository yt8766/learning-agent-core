import type { GatewayCredentialFile } from '@agent/core';
import { GatewayTable } from '../components/GatewayTable';
import { formatGatewayDate } from '../gateway-view-model';

interface CredentialFilesPageProps {
  credentialFiles: GatewayCredentialFile[];
}

export function CredentialFilesPage({ credentialFiles }: CredentialFilesPageProps) {
  return (
    <section className="page-stack" aria-label="认证文件">
      <div className="section-heading">
        <h2>认证文件</h2>
        <p>只展示认证文件元数据，密钥正文不进入前端状态。</p>
      </div>
      <form className="command-panel">
        <label>
          文件 ID
          <input name="credentialFileId" defaultValue={credentialFiles[0]?.id ?? ''} />
        </label>
        <label>
          路径
          <input name="path" defaultValue={credentialFiles[0]?.path ?? ''} />
        </label>
        <div className="command-actions">
          <button type="submit">保存认证文件</button>
          <button type="button">取消</button>
          <button type="button" className="danger-action">
            删除
          </button>
        </div>
      </form>
      <div className="oauth-panel">
        <div>
          <strong>OAuth 授权</strong>
          <p>授权流只展示用户码和验证地址，凭据正文仍保留在后端 secret 边界。</p>
        </div>
        <div className="command-actions">
          <button type="button">开始授权</button>
          <button type="button">完成授权</button>
          <button type="button">刷新状态</button>
        </div>
      </div>
      <GatewayTable
        emptyText="暂无认证文件"
        getRowKey={credentialFile => credentialFile.id}
        items={credentialFiles}
        columns={[
          { key: 'id', header: '文件 ID', render: credentialFile => credentialFile.id },
          { key: 'provider', header: '供应商', render: credentialFile => credentialFile.provider },
          { key: 'path', header: '路径', render: credentialFile => credentialFile.path },
          {
            key: 'status',
            header: '状态',
            render: credentialFile => (
              <span className={`status-pill credential-${credentialFile.status}`}>{credentialFile.status}</span>
            )
          },
          {
            key: 'lastCheckedAt',
            header: '最近检查',
            render: credentialFile => formatGatewayDate(credentialFile.lastCheckedAt)
          }
        ]}
      />
    </section>
  );
}
