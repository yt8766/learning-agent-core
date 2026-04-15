// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { CostAnalysisRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Col, Empty, Row, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import { IntlShape } from 'react-intl';

export interface CostAnalysisChartProps {
  data: CostAnalysisRecord[];
  loading?: boolean;
}

// 字段键值对类型
export interface CostAnalysisFieldKey {
  id: string;
  key: keyof CostAnalysisRecord;
}

// 图表分组类型
export interface ChartGroup {
  title: string;
  keys: CostAnalysisFieldKey[];
}

// 图表配置类型
export interface ChartConfig {
  sortedData: CostAnalysisRecord[];
  chartGroups: ChartGroup[];
}

// SingleChart 组件 Props 类型
export interface SingleChartProps {
  title: string;
  sortedData: CostAnalysisRecord[];
  keys: CostAnalysisFieldKey[];
  intl: IntlShape;
}

// 单个图表组件
const SingleChart = memo(({ title, sortedData, keys, intl }: SingleChartProps) => {
  const getVals = (key: keyof CostAnalysisRecord) => sortedData.map(item => item[key] || 0);

  const series = keys.map(({ id, key }) => ({
    name: intl.formatMessage({ id }),
    type: 'bar',
    yAxisIndex: 0,
    data: getVals(key),
    emphasis: { focus: 'series' }
  }));

  const legendData = keys.map(({ id }) => intl.formatMessage({ id }));

  const legendSelected = Object.fromEntries(keys.map(({ id }) => [intl.formatMessage({ id }), true]));

  return (
    <ProCard title={title} bordered>
      <ReactECharts
        className="w-full"
        style={{ height: '400px' }}
        option={{
          tooltip: echartsConfig.tooltipAxis,
          legend: {
            top: 10,
            type: 'plain',
            orient: 'horizontal',
            left: 'center',
            data: legendData,
            selected: legendSelected
          },
          grid: {
            ...echartsConfig.grid,
            top: 60,
            left: 80
          },
          color: echartsConfig.colors,
          xAxis: {
            type: 'category',
            data: sortedData.map(item => item.dt),
            axisLabel: echartsConfig.axisLabelSmall,
            axisPointer: {
              type: 'shadow'
            }
          },
          yAxis: [
            {
              type: 'value',
              name: intl.formatMessage({
                id: 'data.creatorConsumeBoard.amount'
              }),
              position: 'left',
              axisLabel: echartsConfig.axisLabelSmall
            }
          ],
          series
        }}
      />
    </ProCard>
  );
});

export const CostAnalysisChart = memo(({ data, loading }: CostAnalysisChartProps) => {
  const intl = useIntl();

  const chartConfig = useMemo((): ChartConfig | null => {
    if (!data || data.length === 0) {
      return null;
    }

    // 按日期排序
    const sortedData = [...data].sort((a, b) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    // 定义所有字段
    const allKeys: CostAnalysisFieldKey[] = [
      {
        id: 'data.bonusCenter.costAnalysisData.exchangeCoinUserCnt',
        key: 'exchange_coin_user_cnt'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.exchangeCoinAmount',
        key: 'exchange_coin_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.inviteUserCnt',
        key: 'invite_user_cnt'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.avgInviteCost',
        key: 'avg_invite_cost'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.rechargeAmount',
        key: 'recharge_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.liveAmount',
        key: 'live_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.liveTransferAmount',
        key: 'live_transfer_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.postAmount',
        key: 'post_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.postTransferAmount',
        key: 'post_transfer_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.gameAllBetAmount',
        key: 'game_all_bet_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.gameVoucherDiffAmount',
        key: 'game_voucher_diff_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.gameAllDiffAmount',
        key: 'game_all_diff_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.withdrawalAmount',
        key: 'withdrawal_amount'
      },
      {
        id: 'data.bonusCenter.costAnalysisData.systemStockAmount',
        key: 'system_stock_amount'
      }
    ];

    // 按业务逻辑分组
    const chartGroups: ChartGroup[] = [
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.exchangeCoinUserCnt'
        }),
        keys: allKeys.filter(({ key }) => ['exchange_coin_user_cnt', 'exchange_coin_amount'].includes(key as string))
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.inviteUserCnt'
        }),
        keys: allKeys.filter(({ key }) => ['invite_user_cnt', 'avg_invite_cost'].includes(key as string))
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.rechargeAmount'
        }),
        keys: allKeys.filter(({ key }) => key === 'recharge_amount')
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.liveAmount'
        }),
        keys: allKeys.filter(({ key }) => ['live_amount', 'live_transfer_amount'].includes(key as string))
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.postAmount'
        }),
        keys: allKeys.filter(({ key }) => ['post_amount', 'post_transfer_amount'].includes(key as string))
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.gameAllBetAmount'
        }),
        keys: allKeys.filter(({ key }) =>
          ['game_all_bet_amount', 'game_voucher_diff_amount', 'game_all_diff_amount'].includes(key as string)
        )
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.withdrawalAmount'
        }),
        keys: allKeys.filter(({ key }) => key === 'withdrawal_amount')
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.costAnalysisData.systemStockAmount'
        }),
        keys: allKeys.filter(({ key }) => key === 'system_stock_amount')
      }
    ].filter(group => group.keys.length > 0); // 过滤掉空分组

    return {
      sortedData,
      chartGroups
    };
  }, [data, intl]);

  if (!chartConfig) {
    return (
      <Spin spinning={loading}>
        <ProCard
          title={
            <div className="flex items-center gap-2">
              <div>
                <FormattedMessage id="common.base.chart" />
              </div>
            </div>
          }
        >
          <Empty description={intl.formatMessage({ id: 'common.status.noData' })} />
        </ProCard>
      </Spin>
    );
  }

  return (
    <Spin spinning={loading}>
      <div className="flex flex-col gap-4">
        {/* 第一行：商城兑换、邀请 */}
        <ProCard split="vertical">
          <ProCard colSpan="50%">
            <SingleChart
              title={chartConfig.chartGroups[0]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[0]?.keys || []}
              intl={intl}
            />
          </ProCard>
          <ProCard colSpan="50%">
            <SingleChart
              title={chartConfig.chartGroups[1]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[1]?.keys || []}
              intl={intl}
            />
          </ProCard>
        </ProCard>

        {/* 第二行：充值、直播间 */}
        <ProCard split="vertical">
          <ProCard colSpan="50%">
            <SingleChart
              title={chartConfig.chartGroups[2]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[2]?.keys || []}
              intl={intl}
            />
          </ProCard>
          <ProCard colSpan="50%">
            <SingleChart
              title={chartConfig.chartGroups[3]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[3]?.keys || []}
              intl={intl}
            />
          </ProCard>
        </ProCard>

        {/* 第三行：Post、游戏 */}
        <ProCard split="vertical">
          <ProCard colSpan="50%">
            <SingleChart
              title={chartConfig.chartGroups[4]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[4]?.keys || []}
              intl={intl}
            />
          </ProCard>
          <ProCard colSpan="50%">
            <SingleChart
              title={chartConfig.chartGroups[5]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[5]?.keys || []}
              intl={intl}
            />
          </ProCard>
        </ProCard>

        {/* 第四行：提现、系统库存 */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <SingleChart
              title={chartConfig.chartGroups[6]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[6]?.keys || []}
              intl={intl}
            />
          </Col>
          <Col span={12}>
            <SingleChart
              title={chartConfig.chartGroups[7]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[7]?.keys || []}
              intl={intl}
            />
          </Col>
        </Row>
      </div>
    </Spin>
  );
});
