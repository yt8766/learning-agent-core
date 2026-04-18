// @ts-nocheck
import { getUserRemainData } from '@/services/data/bonusCenter';
import { UserRemainRecord } from '@/types/data/bonusCenter';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { UserRemainChart } from './UserRemainChart';
import { UserRemainMetrics } from './UserRemainMetrics';
import { UserRemainTable } from './UserRemainTable';

export interface UserRemainProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

export const UserRemain = memo(({ loading, searchParams, setLoading }: UserRemainProps) => {
  const [data, setData] = useState<UserRemainRecord[]>([]);

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
  const formatItem = (item: UserRemainRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      app_label: item.app || 'All',
      user_type_label: item.user_type,
      all_user_cnt_label: formatNumber(item.all_user_cnt),
      all_user_remain_1d_percent_label: formatPercent(item.all_user_remain_1d_percent),
      all_user_remain_3d_percent_label: formatPercent(item.all_user_remain_3d_percent),
      all_user_remain_7d_percent_label: formatPercent(item.all_user_remain_7d_percent),
      no_bc_user_cnt_label: formatNumber(item.no_bc_user_cnt),
      no_bc_user_remain_1d_percent_label: formatPercent(item.no_bc_user_remain_1d_percent),
      no_bc_user_remain_3d_percent_label: formatPercent(item.no_bc_user_remain_3d_percent),
      no_bc_user_remain_7d_percent_label: formatPercent(item.no_bc_user_remain_7d_percent),
      in_bc_user_cnt_label: formatNumber(item.in_bc_user_cnt),
      in_bc_user_remain_1d_percent_label: formatPercent(item.in_bc_user_remain_1d_percent),
      in_bc_user_remain_3d_percent_label: formatPercent(item.in_bc_user_remain_3d_percent),
      in_bc_user_remain_7d_percent_label: formatPercent(item.in_bc_user_remain_7d_percent),
      in_bc_user_module_remain_1d_percent_label: formatPercent(item.in_bc_user_module_remain_1d_percent),
      in_bc_user_module_remain_3d_percent_label: formatPercent(item.in_bc_user_module_remain_3d_percent),
      in_bc_user_module_remain_7d_percent_label: formatPercent(item.in_bc_user_module_remain_7d_percent)
    };
  };

  const fetchUserRemainData = async () => {
    try {
      setLoading(true);
      const res = await getUserRemainData({
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
    fetchUserRemainData();
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <UserRemainMetrics data={data} loading={loading} />
      <UserRemainChart data={data} loading={loading} />
      <UserRemainTable data={data} loading={loading} searchParams={searchParams} />
    </div>
  );
});
