import { useState } from 'react';
import {
  ApartmentOutlined,
  BookOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LockOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Button, Checkbox, Divider, Form, Input, Typography } from 'antd';

import { useAuth } from './auth-provider';
import './login-page.css';
import './login-page.auxiliary.css';
import './login-page.responsive.css';

const features = [
  {
    description: '多源异构数据统一接入，构建企业级知识资产中心。',
    icon: <DatabaseOutlined />,
    title: '统一知识接入'
  },
  {
    description: '检索与大模型深度融合，生成更准确、专业的业务答案。',
    icon: <SearchOutlined />,
    title: '智能检索增强'
  },
  {
    description: '精细化权限管理与审计，保障企业数据安全合规。',
    icon: <SafetyCertificateOutlined />,
    title: '安全权限控制'
  }
];

const trustMetrics = [
  { label: '数据源类型', value: '50+' },
  { label: '企业信赖选择', value: '1000+' },
  { label: '稳定可靠运行', value: '99.9%' }
];

const thirdLoginOptions = [
  { icon: <MessageOutlined />, label: '钉钉登录' },
  { icon: <BookOutlined />, label: '飞书登录' },
  { icon: <MessageOutlined />, label: '企业微信登录' }
];

export function LoginPage() {
  const { error, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main aria-label="Knowledge 登录" className="knowledge-login-page">
      <header className="knowledge-login-header">
        <div className="knowledge-login-brand">
          <span className="knowledge-login-brand-mark">
            <BookOutlined />
          </span>
          <span>RAG 企业知识库</span>
        </div>
      </header>

      <div className="knowledge-login-wrap">
        <section className="knowledge-login-hero">
          <Typography.Title className="knowledge-login-hero-title">
            让企业知识流动起来
            <br />让 <em>AI</em> 回答更懂业务
          </Typography.Title>
          <Typography.Paragraph className="knowledge-login-hero-copy">
            融合检索增强与大语言模型能力，统一接入企业文档、制度、案例和系统数据，构建安全、可信、高效的知识应用体系。
          </Typography.Paragraph>

          <div aria-label="RAG 企业知识库产品能力展示" className="knowledge-login-visual">
            <div className="knowledge-login-core">
              <div className="knowledge-login-cube">
                <BookOutlined />
              </div>
            </div>
            <div className="knowledge-login-node knowledge-login-node-doc">
              <span>
                <FileTextOutlined />
              </span>
              文档
            </div>
            <div className="knowledge-login-node knowledge-login-node-graph">
              <span>
                <ApartmentOutlined />
              </span>
              知识图谱
            </div>
            <div className="knowledge-login-node knowledge-login-node-qa">
              <span>
                <SearchOutlined />
              </span>
              问答
            </div>
            <div className="knowledge-login-node knowledge-login-node-source">
              <span>
                <DatabaseOutlined />
              </span>
              数据源
            </div>
          </div>

          <div className="knowledge-login-feature-grid">
            {features.map(feature => (
              <article className="knowledge-login-feature-card" key={feature.title}>
                <div className="knowledge-login-feature-icon">{feature.icon}</div>
                <Typography.Title level={3}>{feature.title}</Typography.Title>
                <Typography.Paragraph>{feature.description}</Typography.Paragraph>
              </article>
            ))}
          </div>

          <div className="knowledge-login-trust-strip">
            {trustMetrics.map(metric => (
              <div className="knowledge-login-trust-item" key={metric.label}>
                <BookOutlined />
                <div>
                  <strong>{metric.value}</strong>
                  <small>{metric.label}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="登录表单" className="knowledge-login-card">
          <div className="knowledge-login-title">
            <Typography.Title level={2}>欢迎登录</Typography.Title>
            <Typography.Paragraph>登录 RAG 企业知识库平台</Typography.Paragraph>
          </div>

          <Form
            className="knowledge-login-form"
            layout="vertical"
            onFinish={() => {
              void login(email, password);
            }}
          >
            <Form.Item name="account">
              <Input
                style={{ height: '56px' }}
                aria-label="账号"
                autoComplete="username"
                id="knowledge-login-account"
                onChange={event => setEmail(event.target.value)}
                placeholder="请输入账号 / 邮箱"
                prefix={<UserOutlined />}
                size="large"
                value={email}
              />
            </Form.Item>
            <Form.Item name="password">
              <Input.Password
                style={{ height: '56px' }}
                aria-label="密码"
                autoComplete="current-password"
                id="knowledge-login-password"
                onChange={event => setPassword(event.target.value)}
                placeholder="请输入密码"
                size="large"
                prefix={<LockOutlined />}
                value={password}
              />
            </Form.Item>
            <div className="knowledge-login-options">
              <Checkbox>记住我</Checkbox>
              <Button className="knowledge-login-link" type="link">
                忘记密码？
              </Button>
            </div>
            <Button aria-label="登录" block htmlType="submit" loading={loading} size="large" type="primary">
              立即登录
            </Button>
            {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
          </Form>

          <Divider className="knowledge-login-divider">其他登录方式</Divider>
          <div className="knowledge-login-third-grid">
            {thirdLoginOptions.map(option => (
              <Button className="knowledge-login-third-button" htmlType="button" key={option.label} type="default">
                {option.icon}
                <span>{option.label}</span>
              </Button>
            ))}
          </div>

          <div className="knowledge-login-foot">
            <QuestionCircleOutlined />
            首次使用请联系管理员开通账号
          </div>
        </section>
      </div>
    </main>
  );
}
