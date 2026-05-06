import { Card, Col, Progress, Row, Space, Table, Tag, Typography, type TableProps } from 'antd';

import { KnowledgeOverviewChart, type KnowledgeOverviewChartPoint } from './knowledge-overview-chart';
import {
  InsightList,
  LifecycleRail,
  MetricStrip,
  RagOpsPage,
  type LifecycleStep,
  type RagOpsMetric
} from '../shared/ui';

interface RiskRow {
  key: string;
  owner: string;
  risk: string;
  severity: '高' | '中' | '低';
  target: string;
  updatedAt: string;
}

const ragMetrics: RagOpsMetric[] = [
  { key: 'spaces', label: '知识空间', status: 'healthy', value: 12 },
  { key: 'readyDocs', label: 'Ready 文档', status: 'healthy', value: '8.4k' },
  { key: 'hitRate', label: '检索质量', status: 'running', suffix: '%', value: 86 },
  { key: 'citation', label: '引用覆盖', status: 'warning', suffix: '%', value: 74 },
  { key: 'feedback', label: '负反馈率', status: 'muted', suffix: '%', value: 3.8 },
  { key: 'latency', label: 'P95 延迟', status: 'warning', suffix: 'ms', value: 1280 }
];

const lifecycleSteps: LifecycleStep[] = [
  {
    description: '连接器巡检、文件上传、解析和清洗统一进入摄取队列。',
    key: 'ingest',
    metric: '今日入库 286 篇，失败 4 篇',
    status: 'warning',
    title: '摄取'
  },
  {
    description: '切片、embedding、向量索引和关键词索引保持可观察。',
    key: 'index',
    metric: '向量覆盖 91%，待补索引 312 chunks',
    status: 'running',
    title: '索引'
  },
  {
    description: 'Query rewrite、hybrid search、rerank 和 metadata filter 统一计入检索质量。',
    key: 'retrieve',
    metric: 'TopK 命中 86%，空召回 12 次',
    status: 'running',
    title: '检索'
  },
  {
    description: '回答必须带 citation、route 和 trace，便于复盘事实来源。',
    key: 'ground',
    metric: '引用覆盖 74%，低置信回答 9 条',
    status: 'warning',
    title: '引用'
  },
  {
    description: '负反馈、missing knowledge 和评测样本进入回归队列。',
    key: 'improve',
    metric: '新增样本 18 条，待回归 5 条',
    status: 'healthy',
    title: '反馈'
  }
];

const riskRows: RiskRow[] = [
  {
    key: 'failed-ingestion',
    owner: '摄取管线',
    risk: '4 篇文档停在 chunk 阶段',
    severity: '高',
    target: '重新解析并隔离异常文件',
    updatedAt: '今日 10:05'
  },
  {
    key: 'missing-knowledge',
    owner: '检索实验室',
    risk: '客户计费策略出现 12 次空召回',
    severity: '中',
    target: '补充 FAQ 并加入 eval dataset',
    updatedAt: '今日 09:42'
  },
  {
    key: 'slow-traces',
    owner: 'Trace 观测',
    risk: 'rerank span P95 超过 1.2s',
    severity: '中',
    target: '检查模型 profile 和 TopK',
    updatedAt: '昨日 18:40'
  },
  {
    key: 'eval-regression',
    owner: '评测回归',
    risk: '引用覆盖比上次发布低 6%',
    severity: '高',
    target: '阻断发布并复测 rerank 配置',
    updatedAt: '今日 08:45'
  }
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

const riskColumns: TableProps<RiskRow>['columns'] = [
  {
    dataIndex: 'risk',
    render: (risk, record) => (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{risk}</Typography.Text>
        <Typography.Text type="secondary">{record.target}</Typography.Text>
      </Space>
    ),
    title: '风险队列'
  },
  { dataIndex: 'owner', title: '责任面', width: 128 },
  {
    dataIndex: 'severity',
    render: severity => (
      <Tag color={severity === '高' ? 'error' : severity === '中' ? 'warning' : 'default'}>{severity}</Tag>
    ),
    title: '级别',
    width: 88
  },
  { dataIndex: 'updatedAt', title: '最近更新', width: 120 }
];

const nextActions = [
  '把客户计费策略的空召回问题加入评测回归集。',
  '对失败文档执行重新解析，必要时隔离来源连接器。',
  '检查 rerank TopK 与模型 profile，降低 trace P95 延迟。',
  '将低置信回答的 citation 证据补齐后再开放给生产应用。'
];

export function OverviewPage() {
  return (
    <RagOpsPage
      eyebrow="RAG Operations"
      subTitle="围绕摄取、索引、检索、引用、反馈和评测回归的统一运行面。"
      title="RAG 运行健康"
    >
      <MetricStrip metrics={ragMetrics} />

      <Row gutter={[16, 16]}>
        <Col xl={15} xs={24}>
          <Card className="rag-ops-panel" title="RAG 生命周期">
            <LifecycleRail steps={lifecycleSteps} />
          </Card>
        </Col>
        <Col xl={9} xs={24}>
          <Card className="rag-ops-panel" title="反馈闭环">
            <Space orientation="vertical" size={14}>
              <Typography.Paragraph>
                从负反馈、空召回和低引用覆盖中沉淀样本，进入评测回归后再释放到生产知识空间。
              </Typography.Paragraph>
              <Progress percent={74} status="active" />
              <InsightList items={nextActions} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col lg={12} xs={24}>
          <Card className="rag-ops-panel" title="检索质量趋势">
            <KnowledgeOverviewChart color="#2563eb" data={retrievalQualityTrend} name="命中率" type="line" unit="%" />
          </Card>
        </Col>
        <Col lg={12} xs={24}>
          <Card className="rag-ops-panel" title="摄取管线吞吐">
            <KnowledgeOverviewChart color="#0891b2" data={ingestionTrend} name="入库文档" type="bar" />
          </Card>
        </Col>
      </Row>

      <Card className="rag-ops-panel" title="治理策略与风险队列">
        <Table<RiskRow> columns={riskColumns} dataSource={riskRows} pagination={false} rowKey="key" />
      </Card>
    </RagOpsPage>
  );
}
