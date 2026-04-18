// @ts-nocheck
import { getAmountRecordData } from '@/services/data/bonusCenter';
import { AmountRecordRecord } from '@/types/data/bonusCenter';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { AmountRecordChart } from './AmountRecordChart';
import { AmountRecordMetrics } from './AmountRecordMetrics';
import { AmountRecordTable } from './AmountRecordTable';

export interface AmountRecordProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

export const AmountRecord = memo(({ loading, searchParams, setLoading }: AmountRecordProps) => {
  const [data, setData] = useState<AmountRecordRecord[]>([]);

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

  // 格式化人均金额
  const formatAvgAmount = (num?: number) => {
    if (num === null || num === undefined) return '-';
    return num.toFixed(2);
  };

  // 格式化单条数据
  const formatItem = (item: AmountRecordRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      app_label: item.app || 'All',
      user_type_label: item.user_type,
      total_record_all_cnt_label: formatNumber(item.total_record_all_cnt),
      total_record_amount_label: formatAmount(item.total_record_amount),
      total_record_user_cnt_label: formatNumber(item.total_record_user_cnt),
      total_record_amount_avg_label: formatAvgAmount(item.total_record_amount_avg),
      invite_record_all_cnt_label: formatNumber(item.invite_record_all_cnt),
      invite_record_amount_label: formatAmount(item.invite_record_amount),
      invite_record_user_cnt_label: formatNumber(item.invite_record_user_cnt),
      invite_record_amount_avg_label: formatAvgAmount(item.invite_record_amount_avg),
      not_invite_record_all_cnt_label: formatNumber(item.not_invite_record_all_cnt),
      not_invite_record_amount_label: formatAmount(item.not_invite_record_amount),
      not_invite_record_user_cnt_label: formatNumber(item.not_invite_record_user_cnt),
      not_invite_record_amount_avg_label: formatAvgAmount(item.not_invite_record_amount_avg)
    };
  };

  const fetchAmountRecordData = async () => {
    try {
      setLoading(true);
      const res = await getAmountRecordData({
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
    fetchAmountRecordData();
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <AmountRecordMetrics data={data} loading={loading} />
      <AmountRecordChart data={data} loading={loading} />
      <AmountRecordTable data={data} loading={loading} searchParams={searchParams} />
    </div>
  );
});
