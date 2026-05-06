import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { Card, Col, Descriptions, Progress, Row, Space, Switch, Tag, Typography } from 'antd';

import { useSettingsSecurity } from '../../hooks/use-knowledge-governance';
import { RagOpsPage } from '../shared/ui';

export function SettingsSecurityPage() {
  const { loading, security } = useSettingsSecurity();

  return (
    <RagOpsPage
      eyebrow="Security Policy"
      subTitle="配置访问控制、审批门、密钥审计和知识空间安全策略。"
      title="安全策略"
    >
      <Row gutter={[16, 16]}>
        <Col lg={8} xs={24}>
          <Card className="rag-ops-panel" loading={loading} title="安全评分">
            <Progress percent={security?.securityScore ?? 0} type="dashboard" />
          </Card>
        </Col>
        <Col lg={16} xs={24}>
          <Card className="rag-ops-panel" loading={loading}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="传输加密">{security?.encryption.transport}</Descriptions.Item>
              <Descriptions.Item label="静态加密">{security?.encryption.atRest}</Descriptions.Item>
              <Descriptions.Item label="密码策略">{security?.passwordPolicy}</Descriptions.Item>
              <Descriptions.Item label="IP 白名单">{security?.ipAllowlist.join('、') || '未配置'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
      <Card className="rag-ops-panel" title="访问与审计">
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <PolicyToggle checked={security?.ssoEnabled} label="SSO 登录" />
          <PolicyToggle checked={security?.mfaRequired} label="MFA 强制校验" />
          <PolicyToggle checked={security?.ipAllowlistEnabled} label="IP 白名单" />
          <PolicyToggle checked={security?.auditLogEnabled} label="审计日志" />
        </Space>
      </Card>
      <Card className="rag-ops-panel" title="审计覆盖">
        <Space wrap>
          <Tag icon={<SafetyOutlined />} color="blue">
            知识库权限变更
          </Tag>
          <Tag icon={<LockOutlined />} color="blue">
            API Key 创建与撤销
          </Tag>
          <Tag icon={<SafetyOutlined />} color="blue">
            高风险审批恢复
          </Tag>
          <Typography.Text type="secondary">所有策略事件进入 Evidence Center 留痕。</Typography.Text>
        </Space>
      </Card>
    </RagOpsPage>
  );
}

function PolicyToggle({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
      <Typography.Text>{label}</Typography.Text>
      <Switch checked={Boolean(checked)} size="small" />
    </Space>
  );
}
