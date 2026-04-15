// @ts-nocheck
import { getRedeemPagePenetrationData } from '@/services/data/bonusCenter';
import { RedeemPagePenetrationRecord } from '@/types/data/bonusCenter';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { RedeemPagePenetrationChart } from './RedeemPagePenetrationChart';
import { RedeemPagePenetrationMetrics } from './RedeemPagePenetrationMetrics';
import { RedeemPagePenetrationTable } from './RedeemPagePenetrationTable';

export interface RedeemPagePenetrationProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

export const RedeemPagePenetration = memo(({ loading, searchParams, setLoading }: RedeemPagePenetrationProps) => {
  const [data, setData] = useState<RedeemPagePenetrationRecord[]>([]);

  // 格式化数字
  const formatNumber = (num?: number) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  // 格式化单条数据
  const formatItem = (item: RedeemPagePenetrationRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      app_label: item.app || 'All',
      user_type_label: item.user_type,
      page_exposure_user_cnt_label: formatNumber(item.page_exposure_user_cnt),
      prompt_module_exposure_user_cnt_label: formatNumber(item.prompt_module_exposure_user_cnt),
      tab_module_exposure_user_cnt_label: formatNumber(item.tab_module_exposure_user_cnt),
      item_list_module_exposure_user_cnt_label: formatNumber(item.item_list_module_exposure_user_cnt),
      claim_button_click_user_cnt_label: formatNumber(item.claim_button_click_user_cnt),
      tab_switch_click_user_cnt_label: formatNumber(item.tab_switch_click_user_cnt),
      item_button_click_user_cnt_label: formatNumber(item.item_button_click_user_cnt)
    };
  };

  const fetchRedeemPagePenetrationData = async () => {
    try {
      setLoading(true);
      const res = await getRedeemPagePenetrationData({
        ...defaultSearchParams,
        ...searchParams
      });
      if (res.code === 0) {
        setData(res.data.list?.map(formatItem) || []);
      }
    } catch {
      return {
        data: [],
        success: false,
        total: 0
      };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedeemPagePenetrationData();
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <RedeemPagePenetrationMetrics data={data} loading={loading} />
      <RedeemPagePenetrationChart data={data} loading={loading} />
      <RedeemPagePenetrationTable data={data} loading={loading} searchParams={searchParams} />
    </div>
  );
});
