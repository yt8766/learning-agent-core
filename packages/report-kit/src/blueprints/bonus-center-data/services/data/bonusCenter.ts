export interface BonusCenterListResponse<TRecord> {
  code: number;
  data: {
    list: TRecord[];
    total: number;
  };
}

type BonusCenterQuery = Record<string, unknown>;

function buildEmptyResponse<TRecord>(): BonusCenterListResponse<TRecord> {
  return {
    code: 0,
    data: {
      list: [],
      total: 0
    }
  };
}

/**
 * Bonus Center 任务页面渗透率数据
 * 使用大数据接口 get_bc_task_page_penetration_data
 */
export async function getTaskPagePenetrationData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 兑换页渗透率数据
 * 使用大数据接口 get_bc_redeem_page_penetration_data
 */
export async function getRedeemPagePenetrationData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 象神祈福页渗透率数据
 * 使用大数据接口 get_bc_puja_page_penetration_data
 */
export async function getPujaPagePenetrationData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 任务完成记录
 * 使用大数据接口 get_bc_task_complete_data
 */
export async function getTaskCompleteData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 新老用户留存
 * 使用大数据接口 get_bc_user_remain_data
 */
export async function getUserRemainData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 银币发放记录
 * 使用大数据接口 get_bc_amount_record_data
 */
export async function getAmountRecordData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 银币兑换记录
 * 使用大数据接口 get_bc_exchange_mall_data
 */
export async function getExchangeMallData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 用户银币分布
 * 使用大数据接口 get_bc_user_amount_distribution_data
 */
export async function getUserAmountDistributionData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}

/**
 * Bonus Center 成本分析数据
 * 使用大数据接口 get_bc_cost_analysis_data
 */
export async function getCostAnalysisData(_query: BonusCenterQuery) {
  return buildEmptyResponse<Record<string, unknown>>();
}
