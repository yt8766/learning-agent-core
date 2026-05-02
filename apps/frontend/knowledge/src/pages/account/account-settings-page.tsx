import { useState } from 'react';
import { CameraOutlined, LockOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Col, Form, Input, Row, Space, Typography, Upload, type UploadProps } from 'antd';

import { useAccountProfileStore } from './account-store';
import { PageSection } from '../shared/ui';

export function AccountSettingsPage() {
  const avatar = useAccountProfileStore(state => state.avatar);
  const displayName = useAccountProfileStore(state => state.displayName);
  const updateAvatar = useAccountProfileStore(state => state.updateAvatar);
  const updateDisplayName = useAccountProfileStore(state => state.updateDisplayName);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const uploadProps: UploadProps = {
    beforeUpload(file) {
      const reader = new FileReader();
      reader.onload = event => {
        if (typeof event.target?.result === 'string') {
          updateAvatar(event.target.result);
        }
      };
      reader.readAsDataURL(file);
      return false;
    },
    maxCount: 1,
    showUploadList: false
  };

  return (
    <PageSection subTitle="维护控制台显示名称、登录密码与头像" title="个人设置">
      <Row gutter={[16, 16]}>
        <Col lg={8} xs={24}>
          <Card className="knowledge-account-profile-card">
            <Space align="center" orientation="vertical" size={16}>
              <Avatar className="knowledge-account-avatar" icon={<UserOutlined />} size={112} src={avatar} />
              <Upload accept="image/*" {...uploadProps}>
                <Button icon={<CameraOutlined />}>更换头像</Button>
              </Upload>
              <Typography.Text type="secondary">头像仅在本地预览，接入真实用户接口后再持久化。</Typography.Text>
            </Space>
          </Card>
        </Col>
        <Col lg={16} xs={24}>
          <Card>
            <Form
              initialValues={{ displayName }}
              layout="vertical"
              onFinish={(values: { displayName?: string }) => {
                updateDisplayName(values.displayName ?? displayName);
                setPasswordTouched(false);
              }}
              onValuesChange={(
                _,
                values: {
                  displayName?: string;
                  currentPassword?: string;
                  newPassword?: string;
                  confirmPassword?: string;
                }
              ) => {
                setPasswordTouched(Boolean(values.currentPassword || values.newPassword || values.confirmPassword));
              }}
            >
              <Form.Item label="显示名称" name="displayName">
                <Input prefix={<UserOutlined />} />
              </Form.Item>
              <Form.Item label="当前密码" name="currentPassword">
                <Input.Password autoComplete="current-password" prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item label="新密码" name="newPassword">
                <Input.Password autoComplete="new-password" prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item label="确认新密码" name="confirmPassword">
                <Input.Password autoComplete="new-password" prefix={<LockOutlined />} />
              </Form.Item>
              <Button icon={<SaveOutlined />} type="primary">
                保存设置
              </Button>
              {passwordTouched ? (
                <Typography.Text className="knowledge-account-password-hint" type="secondary">
                  密码字段当前仅做前端表单演示，接入用户接口后再提交变更。
                </Typography.Text>
              ) : null}
            </Form>
          </Card>
        </Col>
      </Row>
    </PageSection>
  );
}
