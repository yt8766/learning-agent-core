// @ts-nocheck
import { getCostAnalysisData } from '@/services/data/bonusCenter';
import { CostAnalysisRecord } from '@/types/data/bonusCenter';
import { FormattedMessage } from 'react-intl';
import { Card, Radio } from 'antd';
import { RadioChangeEvent } from 'antd/lib';
import { memo, useEffect, useState } from 'react';
import { defaultSearchParams, SearchParams } from '../../config';
import { CostAnalysisChart } from './CostAnalysisChart';
import { CostAnalysisMetrics } from './CostAnalysisMetrics';
import { CostAnalysisTable } from './CostAnalysisTable';

export interface CostAnalysisProps {
  loading: boolean;
  searchParams: SearchParams;
  setLoading: (value: boolean) => void;
}

type ViewMode = 'chart' | 'table';

export const CostAnalysis = memo(({ loading, searchParams, setLoading }: CostAnalysisProps) => {
  const [data, setData] = useState<CostAnalysisRecord[]>([]);
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
  const formatItem = (item: CostAnalysisRecord) => {
    return {
      ...item,
      dt_label: item.dt,
      exchange_coin_user_cnt_label: formatNumber(item.exchange_coin_user_cnt),
      exchange_coin_amount_label: formatAmount(item.exchange_coin_amount),
      invite_user_cnt_label: formatNumber(item.invite_user_cnt),
      avg_invite_cost_label: formatAmount(item.avg_invite_cost),
      recharge_amount_label: formatAmount(item.recharge_amount),
      live_amount_label: formatAmount(item.live_amount),
      live_transfer_amount_label: formatAmount(item.live_transfer_amount),
      post_amount_label: formatAmount(item.post_amount),
      post_transfer_amount_label: formatAmount(item.post_transfer_amount),
      game_all_bet_amount_label: formatAmount(item.game_all_bet_amount),
      game_voucher_diff_amount_label: formatAmount(item.game_voucher_diff_amount),
      game_all_diff_amount_label: formatAmount(item.game_all_diff_amount),
      withdrawal_amount_label: formatAmount(item.withdrawal_amount),
      system_stock_amount_label: formatAmount(item.system_stock_amount)
    };
  };

  /**
   * 获取成本分析数据
   * 调用大数据接口：get_bc_user_cost_data
   */
  const fetchCostAnalysisData = async () => {
    try {
      setLoading(true);
      const res = await getCostAnalysisData({
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
    fetchCostAnalysisData();
  }, [searchParams]);

  const handleViewModeChange = (e: RadioChangeEvent) => {
    setViewMode(e.target.value);
  };

  return (
    <div className="flex flex-col gap-4">
      <CostAnalysisMetrics data={data} loading={loading} />
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
          <CostAnalysisChart data={data} loading={loading} />
        ) : (
          <CostAnalysisTable data={data} loading={loading} />
        )}
      </Card>
    </div>
  );
});
