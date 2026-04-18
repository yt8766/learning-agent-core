// @ts-nocheck
import { getTaskPagePenetrationData } from '@/services/data/bonusCenter';
import { TaskPagePenetrationRecord } from '@/types/data/bonusCenter';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { TaskPagePenetrationChart } from './TaskPagePenetrationChart';
import { TaskPagePenetrationMetrics } from './TaskPagePenetrationMetrics';
import { TaskPagePenetrationTable } from './TaskPagePenetrationTable';

export interface TaskPagePenetrationProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

export const TaskPagePenetration = memo(({ loading, searchParams, setLoading }: TaskPagePenetrationProps) => {
  const [data, setData] = useState<TaskPagePenetrationRecord[]>([]);

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
  const formatItem = (item: TaskPagePenetrationRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      app_label: item.app || 'All',
      user_type_label: item.user_type,
      login_dau_label: formatNumber(item.login_dau),
      bc_both_user_cnt_label: formatNumber(item.bc_both_user_cnt),
      bc_both_user_percent_label: formatPercent(item.bc_both_user_percent),
      page_exposure_user_cnt_label: formatNumber(item.page_exposure_user_cnt),
      module_exposure_user_cnt_label: formatNumber(item.module_exposure_user_cnt),
      button_click_user_cnt_label: formatNumber(item.button_click_user_cnt),
      invite_click_user_cnt_label: formatNumber(item.invite_click_user_cnt),
      task_button_click_user_cnt_label: formatNumber(item.task_button_click_user_cnt),
      page_exposure_user_percent_label: formatPercent(item.page_exposure_user_percent),
      module_exposure_user_percent_label: formatPercent(item.module_exposure_user_percent),
      button_click_user_percent_label: formatPercent(item.button_click_user_percent),
      task_button_click_user_percent_label: formatPercent(item.task_button_click_user_percent),
      invite_click_user_percent_label: formatPercent(item.invite_click_user_percent)
    };
  };

  const fetchTaskPagePenetrationData = async () => {
    try {
      setLoading(true);
      const res = await getTaskPagePenetrationData({
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
    fetchTaskPagePenetrationData();
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <TaskPagePenetrationMetrics data={data} loading={loading} />
      <TaskPagePenetrationChart data={data} loading={loading} />
      <TaskPagePenetrationTable data={data} loading={loading} searchParams={searchParams} />
    </div>
  );
});
