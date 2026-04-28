// @ts-nocheck
import { getTaskCompleteData } from '@/services/data/bonusCenter';
import { TaskCompleteRecord } from '@/types/data/bonusCenter';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { TaskCompleteChart } from './TaskCompleteChart';
import { TaskCompleteMetrics } from './TaskCompleteMetrics';
import { TaskCompleteTable } from './TaskCompleteTable';

export interface TaskCompleteProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

export const TaskComplete = memo(({ loading, searchParams, setLoading }: TaskCompleteProps) => {
  const [data, setData] = useState<TaskCompleteRecord[]>([]);

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
  const formatItem = (item: TaskCompleteRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      app_label: item.app || 'All',
      user_type_label: item.user_type,
      puja_one_stage_exposure_user_cnt_label: formatNumber(item.puja_one_stage_exposure_user_cnt),
      puja_one_stage_complete_user_cnt_label: formatNumber(item.puja_one_stage_complete_user_cnt),
      puja_one_stage_complete_percent_label: formatPercent(item.puja_one_stage_complete_percent),
      puja_two_stage_exposure_user_cnt_label: formatNumber(item.puja_two_stage_exposure_user_cnt),
      puja_two_stage_complete_user_cnt_label: formatNumber(item.puja_two_stage_complete_user_cnt),
      puja_two_stage_complete_percent_label: formatPercent(item.puja_two_stage_complete_percent),
      puja_three_stage_exposure_user_cnt_label: formatNumber(item.puja_three_stage_exposure_user_cnt),
      puja_three_stage_complete_user_cnt_label: formatNumber(item.puja_three_stage_complete_user_cnt),
      puja_three_stage_complete_percent_label: formatPercent(item.puja_three_stage_complete_percent),
      share_live_exposure_user_cnt_label: formatNumber(item.share_live_exposure_user_cnt),
      share_live_complete_user_cnt_label: formatNumber(item.share_live_complete_user_cnt),
      share_live_complete_percent_label: formatPercent(item.share_live_complete_percent),
      share_post_exposure_user_cnt_label: formatNumber(item.share_post_exposure_user_cnt),
      share_post_complete_user_cnt_label: formatNumber(item.share_post_complete_user_cnt),
      share_post_complete_percent_label: formatPercent(item.share_post_complete_percent),
      comment_posts_exposure_user_cnt_label: formatNumber(item.comment_posts_exposure_user_cnt),
      comment_posts_complete_user_cnt_label: formatNumber(item.comment_posts_complete_user_cnt),
      comment_posts_complete_percent_label: formatPercent(item.comment_posts_complete_percent),
      view_game_page_exposure_user_cnt_label: formatNumber(item.view_game_page_exposure_user_cnt),
      view_game_page_complete_user_cnt_label: formatNumber(item.view_game_page_complete_user_cnt),
      view_game_page_complete_percent_label: formatPercent(item.view_game_page_complete_percent),
      follow_user_exposure_user_cnt_label: formatNumber(item.follow_user_exposure_user_cnt),
      follow_user_complete_user_cnt_label: formatNumber(item.follow_user_complete_user_cnt),
      follow_user_complete_percent_label: formatPercent(item.follow_user_complete_percent)
    };
  };

  const fetchTaskCompleteData = async () => {
    try {
      setLoading(true);
      const res = await getTaskCompleteData({
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
    fetchTaskCompleteData();
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <TaskCompleteMetrics data={data} loading={loading} />
      <TaskCompleteChart data={data} loading={loading} />
      <TaskCompleteTable data={data} loading={loading} searchParams={searchParams} />
    </div>
  );
});
