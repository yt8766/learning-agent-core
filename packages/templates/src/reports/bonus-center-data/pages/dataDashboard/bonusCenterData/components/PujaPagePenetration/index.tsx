// @ts-nocheck
import { getPujaPagePenetrationData } from '@/services/data/bonusCenter';
import { PujaPagePenetrationRecord } from '@/types/data/bonusCenter';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { PujaPagePenetrationChart } from './PujaPagePenetrationChart';
import { PujaPagePenetrationMetrics } from './PujaPagePenetrationMetrics';
import { PujaPagePenetrationTable } from './PujaPagePenetrationTable';

export interface PujaPagePenetrationProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

export const PujaPagePenetration = memo(({ loading, searchParams, setLoading }: PujaPagePenetrationProps) => {
  const [data, setData] = useState<PujaPagePenetrationRecord[]>([]);

  // 格式化数字
  const formatNumber = (num?: number) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  // 格式化百分比
  const formatPercent = (value?: number) => {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(2)}%`;
  };

  // 格式化单条数据
  const formatItem = (item: PujaPagePenetrationRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      app_label: item.app || 'All',
      user_type_label: item.user_type,
      // 免费供奉
      free_page_exposure_all_cnt_label: formatNumber(item.free_page_exposure_all_cnt),
      free_page_pray_click_all_cnt_label: formatNumber(item.free_page_pray_click_all_cnt),
      free_page_close_click_all_cnt_label: formatNumber(item.free_page_close_click_all_cnt),
      free_reward_close_click_all_cnt_label: formatNumber(item.free_reward_close_click_all_cnt),
      free_page_exposure_user_cnt_label: formatNumber(item.free_page_exposure_user_cnt),
      free_page_pray_click_user_cnt_label: formatNumber(item.free_page_pray_click_user_cnt),
      free_page_close_click_user_cnt_label: formatNumber(item.free_page_close_click_user_cnt),
      free_reward_close_click_user_cnt_label: formatNumber(item.free_reward_close_click_user_cnt),
      free_page_pray_click_user_percent_label: formatPercent(item.free_page_pray_click_user_percent),
      free_page_close_click_user_percent_label: formatPercent(item.free_page_close_click_user_percent),
      free_reward_close_click_user_percent_label: formatPercent(item.free_reward_close_click_user_percent),
      // 银币供奉
      second_page_exposure_all_cnt_label: formatNumber(item.second_page_exposure_all_cnt),
      second_page_offer_click_all_cnt_label: formatNumber(item.second_page_offer_click_all_cnt),
      second_page_close_click_all_cnt_label: formatNumber(item.second_page_close_click_all_cnt),
      second_page_exposure_user_cnt_label: formatNumber(item.second_page_exposure_user_cnt),
      second_page_offer_click_user_cnt_label: formatNumber(item.second_page_offer_click_user_cnt),
      second_page_close_click_user_cnt_label: formatNumber(item.second_page_close_click_user_cnt),
      second_page_offer_click_user_percent_label: formatPercent(item.second_page_offer_click_user_percent),
      second_page_close_click_user_percent_label: formatPercent(item.second_page_close_click_user_percent),
      // 象神指引
      guidance_page_exposure_all_cnt_label: formatNumber(item.guidance_page_exposure_all_cnt),
      guidance_page_share_click_all_cnt_label: formatNumber(item.guidance_page_share_click_all_cnt),
      guidance_page_close_click_all_cnt_label: formatNumber(item.guidance_page_close_click_all_cnt),
      guidance_page_exposure_user_cnt_label: formatNumber(item.guidance_page_exposure_user_cnt),
      guidance_page_share_click_user_cnt_label: formatNumber(item.guidance_page_share_click_user_cnt),
      guidance_page_close_click_user_cnt_label: formatNumber(item.guidance_page_close_click_user_cnt),
      guidance_page_share_click_user_percent_label: formatPercent(item.guidance_page_share_click_user_percent),
      guidance_page_close_click_user_percent_label: formatPercent(item.guidance_page_close_click_user_percent)
    };
  };

  const fetchPujaPagePenetrationData = async () => {
    try {
      setLoading(true);
      const res = await getPujaPagePenetrationData({
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
    fetchPujaPagePenetrationData();
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <PujaPagePenetrationMetrics data={data} loading={loading} />
      <PujaPagePenetrationChart data={data} loading={loading} />
      <PujaPagePenetrationTable data={data} loading={loading} searchParams={searchParams} />
    </div>
  );
});
