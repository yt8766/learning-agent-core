import type { CompanyExpertDefinition, CompanyExpertId } from '@agent/core';

export const companyLiveCoreExpertIds = [
  'productAgent',
  'operationsAgent',
  'contentAgent',
  'growthAgent',
  'riskAgent',
  'financeAgent'
] satisfies CompanyExpertId[];

export const companyLiveExpertDefinitions = [
  {
    expertId: 'productAgent',
    displayName: '产品专家',
    role: 'product',
    phase: 'core',
    responsibilities: ['商品定位', '用户体验', '卖点包装', '购买路径', '留存'],
    boundaries: ['不审批投放预算', '不直接编写完整直播脚本'],
    keywords: ['商品', '产品', '卖点', '体验', '漏斗', '用户为什么买']
  },
  {
    expertId: 'operationsAgent',
    displayName: '运营专家',
    role: 'operations',
    phase: 'core',
    responsibilities: ['直播排期', '主播协作', '场控流程', '活动节奏', '执行 SOP'],
    boundaries: ['不判断毛利', '不替代风控审批'],
    keywords: ['主播', '排期', '场控', '直播间', 'SOP', '运营']
  },
  {
    expertId: 'contentAgent',
    displayName: '内容专家',
    role: 'content',
    phase: 'core',
    responsibilities: ['直播脚本', '短视频素材', '话术', '本地化表达', '视觉方向'],
    boundaries: ['不得绕过风控禁用话术', '不承诺未经证据支持的功效'],
    keywords: ['脚本', '话术', '短视频', '素材', '本地化', '视觉']
  },
  {
    expertId: 'growthAgent',
    displayName: '增长专家',
    role: 'growth',
    phase: 'core',
    responsibilities: ['GMV', '转化率', '拉新', '复购', '区域增长策略'],
    boundaries: ['不批准折扣', '不批准预算'],
    keywords: ['转化', 'GMV', '增长', '复购', '拉新']
  },
  {
    expertId: 'marketingAgent',
    displayName: '市场营销专家',
    role: 'marketing',
    phase: 'reserved',
    responsibilities: ['投放', 'Campaign', '达人合作', '品牌表达', '渠道策略'],
    boundaries: ['不替代增长指标拆解'],
    keywords: ['投放', '达人', 'Campaign', '渠道', '品牌']
  },
  {
    expertId: 'intelligenceAgent',
    displayName: '市场情报专家',
    role: 'intelligence',
    phase: 'reserved',
    responsibilities: ['竞品', '平台政策', '区域趋势', '用户偏好', '达人生态'],
    boundaries: ['不编造外部事实', '缺少来源时必须说明'],
    keywords: ['竞品', '政策', '趋势', '达人生态', '市场情报']
  },
  {
    expertId: 'riskAgent',
    displayName: '风控合规专家',
    role: 'risk',
    phase: 'core',
    responsibilities: ['违规话术', '平台封禁', '欺诈', '退款风险', '审批审计'],
    boundaries: ['高风险结论优先于内容和增长建议'],
    keywords: ['风险', '合规', '违规', '封禁', '退款', '审计']
  },
  {
    expertId: 'financeAgent',
    displayName: '财务专家',
    role: 'finance',
    phase: 'core',
    responsibilities: ['毛利', '折扣', '预算', 'ROI', '结算', '现金流'],
    boundaries: ['缺少价格或成本时必须标记缺失输入'],
    keywords: ['利润', '预算', 'ROI', '毛利', '折扣', '结算']
  },
  {
    expertId: 'supportAgent',
    displayName: '客服售后专家',
    role: 'support',
    phase: 'reserved',
    responsibilities: ['用户问题', '投诉', '退货退款', '售后话术', '服务承诺'],
    boundaries: ['不承诺未确认的售后政策'],
    keywords: ['客服', '售后', '投诉', '退货', '用户问题']
  },
  {
    expertId: 'supplyAgent',
    displayName: '供应链履约专家',
    role: 'supply',
    phase: 'reserved',
    responsibilities: ['库存', '备货', '发货', '物流时效', '缺货风险'],
    boundaries: ['缺少库存和物流数据时必须标记缺失输入'],
    keywords: ['库存', '备货', '发货', '物流', '履约']
  }
] satisfies CompanyExpertDefinition[];
