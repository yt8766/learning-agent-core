// @ts-nocheck
import { getExchangeMallData } from '@/services/data/bonusCenter';
import { ExchangeMallRecord } from '@/types/data/bonusCenter';
import { FormattedMessage } from 'react-intl';
import { Card, Radio } from 'antd';
import { RadioChangeEvent } from 'antd/lib';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { ExchangeMallChart } from './ExchangeMallChart';
import { ExchangeMallMetrics } from './ExchangeMallMetrics';
import { ExchangeMallTable } from './ExchangeMallTable';

export interface ExchangeMallProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

type ViewMode = 'chart' | 'table';

export const ExchangeMall = memo(({ loading, searchParams, setLoading }: ExchangeMallProps) => {
  const [data, setData] = useState<ExchangeMallRecord[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // 格式化数字
  const formatNumber = (num?: number) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  // 格式化金额
  const formatAmount = (num?: number) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  // 格式化单条数据
  const formatItem = (item: ExchangeMallRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      app_label: item.app || 'All',
      user_type_label: item.user_type,
      props_all_cnt_label: formatNumber(item.props_all_cnt),
      props_amount_label: formatAmount(item.props_amount),
      props_user_cnt_label: formatNumber(item.props_user_cnt),
      coin_all_cnt_label: formatNumber(item.coin_all_cnt),
      coin_amount_label: formatAmount(item.coin_amount),
      coin_asset_amount_label: formatAmount(item.coin_asset_amount),
      coin_user_cnt_label: formatNumber(item.coin_user_cnt),
      voucher_all_cnt_label: formatNumber(item.voucher_all_cnt),
      voucher_amount_label: formatAmount(item.voucher_amount),
      voucher_user_cnt_label: formatNumber(item.voucher_user_cnt),
      vip_voucher_all_cnt_label: formatNumber(item.vip_voucher_all_cnt),
      vip_voucher_amount_label: formatAmount(item.vip_voucher_amount),
      vip_voucher_user_cnt_label: formatNumber(item.vip_voucher_user_cnt),
      puja_all_cnt_label: formatNumber(item.puja_all_cnt),
      puja_amount_label: formatAmount(item.puja_amount),
      puja_user_cnt_label: formatNumber(item.puja_user_cnt),
      system_retrieve_all_cnt_label: formatNumber(item.system_retrieve_all_cnt),
      system_retrieve_amount_label: formatAmount(item.system_retrieve_amount),
      system_retrieve_user_cnt_label: formatNumber(item.system_retrieve_user_cnt),
      post_total_all_cnt_label: formatNumber(item.post_total_all_cnt),
      post_total_amount_label: formatAmount(item.post_total_amount),
      post_total_user_cnt_label: formatNumber(item.post_total_user_cnt),
      post_1_all_cnt_label: formatNumber(item.post_1_all_cnt),
      post_1_amount_label: formatAmount(item.post_1_amount),
      post_1_user_cnt_label: formatNumber(item.post_1_user_cnt),
      post_2_all_cnt_label: formatNumber(item.post_2_all_cnt),
      post_2_amount_label: formatAmount(item.post_2_amount),
      post_2_user_cnt_label: formatNumber(item.post_2_user_cnt),
      post_3_all_cnt_label: formatNumber(item.post_3_all_cnt),
      post_3_amount_label: formatAmount(item.post_3_amount),
      post_3_user_cnt_label: formatNumber(item.post_3_user_cnt),
      post_4_all_cnt_label: formatNumber(item.post_4_all_cnt),
      post_4_amount_label: formatAmount(item.post_4_amount),
      post_4_user_cnt_label: formatNumber(item.post_4_user_cnt)
    };
  };

  const fetchExchangeMallData = async () => {
    try {
      setLoading(true);
      const res = await getExchangeMallData({
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
    fetchExchangeMallData();
  }, [searchParams]);

  const handleViewModeChange = (e: RadioChangeEvent) => {
    setViewMode(e.target.value);
  };

  return (
    <div className="flex flex-col gap-4">
      <ExchangeMallMetrics data={data} loading={loading} />
      <Card>
        <Radio.Group value={viewMode} onChange={handleViewModeChange} buttonStyle="solid" style={{ marginBottom: 16 }}>
          <Radio.Button value="chart">
            <FormattedMessage id="common.base.chart" />
          </Radio.Button>
          <Radio.Button value="table">
            <FormattedMessage id="common.base.table" />
          </Radio.Button>
        </Radio.Group>
        {viewMode === 'chart' ? (
          <ExchangeMallChart data={data} loading={loading} />
        ) : (
          <ExchangeMallTable data={data} loading={loading} searchParams={searchParams} />
        )}
      </Card>
    </div>
  );
});
