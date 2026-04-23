import type { ExchangeMallRecord } from '@/types/data/bonusCenter';

export type ExchangeMallChartKey = {
  id: string;
  key: keyof ExchangeMallRecord;
};

export const EXCHANGE_MALL_CHART_KEYS: ExchangeMallChartKey[] = [
  { id: 'data.bonusCenter.propsAllCnt', key: 'props_all_cnt' },
  { id: 'data.bonusCenter.propsAmount', key: 'props_amount' },
  { id: 'data.bonusCenter.propsUserCnt', key: 'props_user_cnt' },
  { id: 'data.bonusCenter.coinAllCnt', key: 'coin_all_cnt' },
  { id: 'data.bonusCenter.coinAmount', key: 'coin_amount' },
  { id: 'data.bonusCenter.coinAssetAmount', key: 'coin_asset_amount' },
  { id: 'data.bonusCenter.coinUserCnt', key: 'coin_user_cnt' },
  { id: 'data.bonusCenter.voucherAllCnt', key: 'voucher_all_cnt' },
  { id: 'data.bonusCenter.voucherAmount', key: 'voucher_amount' },
  { id: 'data.bonusCenter.voucherUserCnt', key: 'voucher_user_cnt' },
  { id: 'data.bonusCenter.vipVoucherAllCnt', key: 'vip_voucher_all_cnt' },
  { id: 'data.bonusCenter.vipVoucherAmount', key: 'vip_voucher_amount' },
  { id: 'data.bonusCenter.vipVoucherUserCnt', key: 'vip_voucher_user_cnt' },
  { id: 'data.bonusCenter.pujaAllCnt', key: 'puja_all_cnt' },
  { id: 'data.bonusCenter.pujaAmount', key: 'puja_amount' },
  { id: 'data.bonusCenter.pujaUserCnt', key: 'puja_user_cnt' },
  { id: 'data.bonusCenter.systemRetrieveAllCnt', key: 'system_retrieve_all_cnt' },
  { id: 'data.bonusCenter.systemRetrieveAmount', key: 'system_retrieve_amount' },
  { id: 'data.bonusCenter.systemRetrieveUserCnt', key: 'system_retrieve_user_cnt' },
  { id: 'data.bonusCenter.postTotalAllCnt', key: 'post_total_all_cnt' },
  { id: 'data.bonusCenter.postTotalAmount', key: 'post_total_amount' },
  { id: 'data.bonusCenter.postTotalUserCnt', key: 'post_total_user_cnt' },
  { id: 'data.bonusCenter.post1AllCnt', key: 'post_1_all_cnt' },
  { id: 'data.bonusCenter.post1Amount', key: 'post_1_amount' },
  { id: 'data.bonusCenter.post1UserCnt', key: 'post_1_user_cnt' },
  { id: 'data.bonusCenter.post2AllCnt', key: 'post_2_all_cnt' },
  { id: 'data.bonusCenter.post2Amount', key: 'post_2_amount' },
  { id: 'data.bonusCenter.post2UserCnt', key: 'post_2_user_cnt' },
  { id: 'data.bonusCenter.post3AllCnt', key: 'post_3_all_cnt' },
  { id: 'data.bonusCenter.post3Amount', key: 'post_3_amount' },
  { id: 'data.bonusCenter.post3UserCnt', key: 'post_3_user_cnt' },
  { id: 'data.bonusCenter.post4AllCnt', key: 'post_4_all_cnt' },
  { id: 'data.bonusCenter.post4Amount', key: 'post_4_amount' },
  { id: 'data.bonusCenter.post4UserCnt', key: 'post_4_user_cnt' }
];

export const EXCHANGE_MALL_CHART_GROUP_IDS: Array<{
  titleId: string;
  prefix: string;
}> = [
  { titleId: 'data.bonusCenter.propsAllCnt', prefix: 'props_' },
  { titleId: 'data.bonusCenter.coinAllCnt', prefix: 'coin_' },
  { titleId: 'data.bonusCenter.voucherAllCnt', prefix: 'voucher_' },
  { titleId: 'data.bonusCenter.vipVoucherAllCnt', prefix: 'vip_voucher_' },
  { titleId: 'data.bonusCenter.pujaAllCnt', prefix: 'puja_' },
  { titleId: 'data.bonusCenter.systemRetrieveAllCnt', prefix: 'system_retrieve_' },
  { titleId: 'data.bonusCenter.postTotalAllCnt', prefix: 'post_total_' },
  { titleId: 'data.bonusCenter.post1AllCnt', prefix: 'post_1_' },
  { titleId: 'data.bonusCenter.post2AllCnt', prefix: 'post_2_' },
  { titleId: 'data.bonusCenter.post3AllCnt', prefix: 'post_3_' },
  { titleId: 'data.bonusCenter.post4AllCnt', prefix: 'post_4_' }
];
