import { Badge, Card, Col, Progress, Row, Space, Statistic, Table, Tag, Typography, type TableProps } from 'antd';

import { KnowledgeOverviewChart, type KnowledgeOverviewChartPoint } from './knowledge-overview-chart';

interface RuntimeMetric {
  key: string;
  label: string;
  suffix?: string;
  value: number | string;
}

interface GovernanceArea {
  description: string;
  key: string;
  status: '稳定' | '观察中' | '待治理';
  title: string;
}

interface PipelineRow {
  key: string;
  owner: string;
  stage: string;
  status: string;
  updatedAt: string;
}

const runtimeMetrics: RuntimeMetric[] = [
  { key: 'collections', label: '知识库空间', value: 12 },
  { key: 'documents', label: '已治理文档', value: '8.4k' },
  { key: 'retrieval', label: '检索命中率', suffix: '%', value: 86 },
  { key: 'experiments', label: '对话实验', value: 27 }
];

const governanceAreas: GovernanceArea[] = [
  {
    description: '统一跟踪连接器、解析器、切片策略与索引刷新状态，保证文档从来源到向量库可观察。',
    key: 'ingestion',
    status: '稳定',
    title: '文档摄取'
  },
  {
    description: '关注召回覆盖、重排质量、来源引用与查询改写效果，让 RAG 回答能够解释和复现。',
    key: 'retrieval',
    status: '观察中',
    title: '检索质量'
  },
  {
    description: '沉淀业务问题集、对话样例与回答证据，支撑知识库上线前的灰度验证。',
    key: 'lab',
    status: '稳定',
    title: '对话实验室'
  },
  {
    description: '按租户、空间、标签与风险级别管理同步权限、引用边界和自动学习策略。',
    key: 'policy',
    status: '待治理',
    title: '治理策略'
  }
];

const pipelineRows: PipelineRow[] = [
  {
    key: 'connectors',
    owner: '户部 / Knowledge Runtime',
    stage: '来源连接器巡检',
    status: '正常',
    updatedAt: '今日 09:20'
  },
  {
    key: 'parser',
    owner: '户部 / Document Pipeline',
    stage: '文档解析与切片',
    status: '观察中',
    updatedAt: '今日 10:05'
  },
  {
    key: 'retrieval',
    owner: '刑部 / Quality Gate',
    stage: '检索质量回归',
    status: '待补样本',
    updatedAt: '昨日 18:40'
  },
  { key: 'evals', owner: '礼部 / Evaluation Center', stage: '评测报告归档', status: '正常', updatedAt: '今日 08:45' }
];

const focusItems = [
  '把高频业务问答沉淀为可复用样本集，持续覆盖召回、引用和回答一致性。',
  '对新增知识源启用摄取前检查，避免低质量文档直接进入主索引。',
  '在观测中心跟踪失败查询、空召回和低置信回答，形成治理待办闭环。'
];

const retrievalQualityTrend: KnowledgeOverviewChartPoint[] = [
  { label: '周一', value: 78 },
  { label: '周二', value: 82 },
  { label: '周三', value: 80 },
  { label: '周四', value: 85 },
  { label: '周五', value: 86 },
  { label: '周六', value: 88 },
  { label: '周日', value: 87 }
];

const ingestionTrend: KnowledgeOverviewChartPoint[] = [
  { label: '周一', value: 182 },
  { label: '周二', value: 248 },
  { label: '周三', value: 214 },
  { label: '周四', value: 320 },
  { label: '周五', value: 286 },
  { label: '周六', value: 168 },
  { label: '周日', value: 196 }
];

const pipelineColumns: TableProps<PipelineRow>['columns'] = [
  {
    dataIndex: 'stage',
    title: '治理链路',
    width: 180
  },
  {
    dataIndex: 'owner',
    title: '责任域'
  },
  {
    dataIndex: 'status',
    render: status => {
      const color = status === '正常' ? 'success' : status === '观察中' ? 'processing' : 'warning';
      return <Tag color={color}>{status}</Tag>;
    },
    title: '状态',
    width: 112
  },
  {
    dataIndex: 'updatedAt',
    title: '最近更新',
    width: 120
  }
];

const statusColor: Record<GovernanceArea['status'], string> = {
  待治理: 'warning',
  稳定: 'success',
  观察中: 'processing'
};

export function OverviewPage() {
  return (
    <div className="knowledge-overview-page">
      <Typography.Title className="knowledge-overview-eyebrow" level={4}>
        Knowledge 知识库控制台
      </Typography.Title>
      <Card className="knowledge-overview-card">
        <Row className="knowledge-overview-dashboard" gutter={[20, 20]}>
          <Col lg={14} xs={24}>
            <Space className="knowledge-overview-heading" orientation="vertical" size={6}>
              <Typography.Title level={2}>Knowledge 运行总览</Typography.Title>
              <Typography.Text type="secondary">
                知识库治理驾驶舱，面向知识摄取、检索质量、对话实验、观测评测与治理策略的统一工作台。
              </Typography.Text>
            </Space>

            <Row gutter={[16, 16]}>
              {runtimeMetrics.map(metric => (
                <Col key={metric.key} lg={12} sm={12} xs={24}>
                  <Card className="knowledge-overview-metric" size="small">
                    <Statistic title={metric.label} value={metric.value} suffix={metric.suffix} />
                  </Card>
                </Col>
              ))}
            </Row>

            <Card className="knowledge-overview-focus-card" size="small">
              <Typography.Title level={3}>本周治理重点</Typography.Title>
              <ul className="knowledge-overview-focus-list">
                {focusItems.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </Col>
          <Col lg={10} xs={24}>
            <Space className="knowledge-overview-chart-stack" orientation="vertical">
              <Card className="knowledge-overview-top-chart" size="small" title="检索质量趋势">
                <KnowledgeOverviewChart
                  color="#1677ff"
                  data={retrievalQualityTrend}
                  name="命中率"
                  type="line"
                  unit="%"
                />
              </Card>
              <Card className="knowledge-overview-top-chart" size="small" title="文档摄取趋势">
                <KnowledgeOverviewChart color="#13c2c2" data={ingestionTrend} name="入库文档" type="bar" />
              </Card>
              <Row gutter={[12, 12]}>
                <Col md={8} xs={24}>
                  <Card className="knowledge-overview-side-card" size="small">
                    <Badge className="knowledge-overview-index" count="观测" />
                    <Space orientation="vertical" size={8}>
                      <Typography.Text strong>检索健康度</Typography.Text>
                      <Progress percent={86} size="small" status="active" />
                    </Space>
                  </Card>
                </Col>
                <Col md={8} xs={24}>
                  <Card className="knowledge-overview-side-card" size="small">
                    <Badge className="knowledge-overview-index" count="评测" />
                    <Typography.Text type="secondary">业务问题集与回归报告发布前校验。</Typography.Text>
                  </Card>
                </Col>
                <Col md={8} xs={24}>
                  <Card className="knowledge-overview-side-card" size="small">
                    <Badge className="knowledge-overview-index" count="策略" />
                    <Typography.Text type="secondary">按可信度与租户边界控制复用。</Typography.Text>
                  </Card>
                </Col>
              </Row>
            </Space>
          </Col>
        </Row>

        <section>
          <Typography.Title level={3}>治理工作面</Typography.Title>
          <Row gutter={[16, 16]}>
            {governanceAreas.map(area => (
              <Col key={area.key} lg={12} xs={24}>
                <Card className="knowledge-overview-area" size="small">
                  <Space align="start" orientation="vertical" size={8}>
                    <Space align="center">
                      <Typography.Text strong>{area.title}</Typography.Text>
                      <Tag color={statusColor[area.status]}>{area.status}</Tag>
                    </Space>
                    <Typography.Text type="secondary">{area.description}</Typography.Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </section>

        <section>
          <Typography.Title level={3}>链路状态</Typography.Title>
          <Table<PipelineRow> columns={pipelineColumns} dataSource={pipelineRows} pagination={false} size="small" />
        </section>
      </Card>
    </div>
  );
}
