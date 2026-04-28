// @ts-nocheck
import { getUserAmountDistributionData } from '@/services/data/bonusCenter';
import { UserAmountDistributionRecord } from '@/types/data/bonusCenter';
import { FormattedMessage } from 'react-intl';
import { Alert } from 'antd';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { UserAmountDistributionChart } from './UserAmountDistributionChart';
import { UserAmountDistributionMetrics } from './UserAmountDistributionMetrics';
import { UserAmountDistributionTable } from './UserAmountDistributionTable';

export interface UserAmountDistributionProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

export const UserAmountDistribution = memo(({ loading, searchParams, setLoading }: UserAmountDistributionProps) => {
  const [data, setData] = useState<UserAmountDistributionRecord[]>([]);

  // 格式化数字
  const formatNumber = (num?: number) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  // 格式化单条数据
  const formatItem = (item: UserAmountDistributionRecord) => {
    return {
      ...item,
      range_order_label: formatNumber(item.range_order),
      amount_range_label: item.amount_range,
      user_cnt_label: formatNumber(item.user_cnt),
      silver_coin_label: formatNumber(item.silver_coin),
      pct_0_label: formatNumber(item.pct_0),
      pct_0_10_label: formatNumber(item.pct_0_10),
      pct_10_20_label: formatNumber(item.pct_10_20),
      pct_20_30_label: formatNumber(item.pct_20_30),
      pct_30_40_label: formatNumber(item.pct_30_40),
      pct_40_50_label: formatNumber(item.pct_40_50),
      pct_50_60_label: formatNumber(item.pct_50_60),
      pct_60_70_label: formatNumber(item.pct_60_70),
      pct_70_80_label: formatNumber(item.pct_70_80),
      pct_80_90_label: formatNumber(item.pct_80_90),
      pct_90_100_label: formatNumber(item.pct_90_100)
    };
  };

  const fetchUserAmountDistributionData = async () => {
    try {
      setLoading(true);
      const res = await getUserAmountDistributionData({
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
    fetchUserAmountDistributionData();
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <Alert
        message={<FormattedMessage id="data.bonusCenter.amountRangeTip" />}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <UserAmountDistributionMetrics data={data} loading={loading} />
      <UserAmountDistributionChart data={data} loading={loading} />
      <UserAmountDistributionTable data={data} loading={loading} searchParams={searchParams} />
    </div>
  );
});
