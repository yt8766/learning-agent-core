import { ExpertFindingSchema, type CompanyExpertDefinition, type CompanyLiveContentBrief } from '@agent/core';

export function buildCompanyLiveFallbackFinding(input: {
  brief: CompanyLiveContentBrief;
  question: string;
  expert: CompanyExpertDefinition;
}) {
  const { brief, question, expert } = input;
  const context = `${brief.targetPlatform}/${brief.targetRegion}`;

  const finding = (() => {
    switch (expert.expertId) {
      case 'productAgent':
        return {
          summary: `产品定位需要先把 ${context} 用户、卖点证据和购买理由对齐。`,
          diagnosis: [
            `当前商品引用为 ${brief.productRefs.join('、') || '未提供'}，卖点需要绑定可验证证据。`,
            `用户问题「${question}」需要先明确目标人群的首要购买阻力。`
          ],
          recommendations: ['把核心卖点压缩为 1 个主承诺和 2 个证明点。', '补充商品规格、适用人群和禁用场景。'],
          questionsToUser: ['商品详情页或 SKU 规格是否已确认？', '是否有真实用户评价或转化证据？'],
          risks: ['卖点过泛会降低直播间停留与成交效率。'],
          confidence: 0.64
        };
      case 'operationsAgent':
        return {
          summary: `运营侧需要把 ${brief.targetPlatform} 直播节奏、主播动作和场控 SOP 固化。`,
          diagnosis: ['当前 brief 尚未明确直播排期、主播分工和关键转场节点。'],
          recommendations: ['按开场、种草、福利、逼单、答疑拆直播间 SOP。', '为每个福利点配置场控提醒和库存口径。'],
          questionsToUser: ['预计直播时长和主播人数是多少？', '是否已有活动排期与库存水位？'],
          risks: ['没有场控 SOP 时，优惠、库存和合规提醒容易在直播中失序。'],
          confidence: 0.62
        };
      case 'contentAgent':
        return {
          summary: '内容侧需要补齐脚本结构、短视频钩子和可用话术边界。',
          diagnosis: ['当前卖点可用，但还需要转成开场钩子、痛点证明和成交口播。'],
          recommendations: [
            '产出 15 秒短视频钩子、30 秒种草脚本和直播间三段式话术。',
            '把合规禁用词前置到脚本检查表。'
          ],
          questionsToUser: ['是否有历史高转化脚本或禁用话术清单？'],
          risks: ['脚本如果直接承诺效果，可能触发平台审核或退款争议。'],
          confidence: 0.66
        };
      case 'growthAgent':
        return {
          summary: '增长侧需要明确 GMV 目标、转化假设和复购承接。',
          diagnosis: ['当前 brief 尚未给出流量来源、转化率基线和目标 GMV。'],
          recommendations: ['拆分曝光、进房、停留、点击和成交漏斗。', '用小额 A/B 先验证主卖点和福利强度。'],
          questionsToUser: ['目标 GMV、客单价和预计流量分别是多少？'],
          risks: ['只提高折扣不验证转化假设，会侵蚀毛利并弱化长期复购。'],
          confidence: 0.6
        };
      case 'riskAgent':
        return {
          summary: `风控侧需要围绕 ${brief.riskLevel} 风险等级建立话术和素材审查门。`,
          diagnosis: ['当前 brief 需要逐条检查功效承诺、价格承诺、售后承诺和平台敏感表达。'],
          recommendations: ['在脚本发布前增加禁用词、证据引用和审批记录检查。', '高风险表达改成可证明、可追溯的描述。'],
          questionsToUser: ['是否已有平台规则、法务意见或历史违规记录？'],
          risks: ['未经证据支持的功效和绝对化表达可能导致审核失败。'],
          confidence: 0.7
        };
      case 'financeAgent':
        return {
          summary: '财务侧需要先补商品成本，再判断折扣、毛利和 ROI。',
          diagnosis: ['当前 brief 没有商品成本、售价、佣金、投放预算和履约费用。'],
          recommendations: [
            '先补齐成本表，再计算最低可接受折扣和 ROI 临界点。',
            '把增长方案拆成保守、基准、进攻三档预算。'
          ],
          questionsToUser: ['商品成本是多少？', '售价、佣金比例和预计投放预算是多少？'],
          risks: ['缺少商品成本时，任何 ROI 或折扣判断都只能作为假设。'],
          confidence: 0.58
        };
      default:
        return {
          summary: `${expert.displayName}需要基于当前 brief 补齐专项输入后再给出结论。`,
          diagnosis: [`当前问题「${question}」涉及 ${expert.responsibilities.join('、')}，但输入不足。`],
          recommendations: ['先收集该专家职责范围内的关键事实，再进入执行方案。'],
          questionsToUser: [`请补充与${expert.displayName}相关的已知约束和目标。`],
          risks: ['输入不足时，专项建议只能作为低置信度假设。'],
          confidence: 0.45
        };
    }
  })();

  return ExpertFindingSchema.parse({
    expertId: expert.expertId,
    role: expert.role,
    ...finding,
    source: 'fallback'
  });
}
