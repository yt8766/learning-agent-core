import { useState } from 'react';
import { BookOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Space, Typography } from 'antd';

import { useAuth } from './auth-provider';

export function LoginPage() {
  const { error, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main
      style={{
        alignItems: 'center',
        background: '#f5f7fb',
        display: 'grid',
        minHeight: '100vh',
        padding: 24
      }}
    >
      <Card style={{ justifySelf: 'center', width: 'min(100%, 400px)' }}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Space>
            <BookOutlined style={{ color: '#1677ff', fontSize: 28 }} />
            <Typography.Title level={2} style={{ margin: 0 }}>
              Knowledge
            </Typography.Title>
          </Space>
          <Form
            layout="vertical"
            onFinish={() => {
              void login(email, password);
            }}
          >
            <Form.Item label="账号">
              <Input autoComplete="username" onChange={event => setEmail(event.target.value)} value={email} />
            </Form.Item>
            <Form.Item label="密码">
              <Input.Password
                autoComplete="current-password"
                onChange={event => setPassword(event.target.value)}
                value={password}
              />
            </Form.Item>
            <Button aria-label="登录" block htmlType="submit" loading={loading} type="primary">
              登录
            </Button>
            {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
          </Form>
        </Space>
      </Card>
    </main>
  );
}
