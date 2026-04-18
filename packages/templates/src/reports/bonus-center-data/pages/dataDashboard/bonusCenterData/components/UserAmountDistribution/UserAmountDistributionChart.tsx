// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { UserAmountDistributionRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';

export interface UserAmountDistributionChartProps {
  data: UserAmountDistributionRecord[];
  loading?: boolean;
}

export const UserAmountDistributionChart = memo(({ data, loading }: UserAmountDistributionChartProps) => {
  const intl = useIntl();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    // 按序号排序
    const sortedData = [...data].sort((a, b) => (a.range_order || 0) - (b.range_order || 0));

    // 左轴：用户数、总余额（柱状图）
    const leftBarKeys: Array<{
      id: string;
      key: keyof UserAmountDistributionRecord;
    }> = [
      {
        id: 'data.bonusCenter.userCnt',
        key: 'user_cnt'
      },
      {
        id: 'data.bonusCenter.silverCoin',
        key: 'silver_coin'
      }
    ];

    // 右轴：各消耗百分比（折线图）
    const rightLineKeys: Array<{
      id: string;
      key: keyof UserAmountDistributionRecord;
    }> = [
      {
        id: 'data.bonusCenter.pct0',
        key: 'pct_0'
      },
      {
        id: 'data.bonusCenter.pct0_10',
        key: 'pct_0_10'
      },
      {
        id: 'data.bonusCenter.pct10_20',
        key: 'pct_10_20'
      },
      {
        id: 'data.bonusCenter.pct20_30',
        key: 'pct_20_30'
      },
      {
        id: 'data.bonusCenter.pct30_40',
        key: 'pct_30_40'
      },
      {
        id: 'data.bonusCenter.pct40_50',
        key: 'pct_40_50'
      },
      {
        id: 'data.bonusCenter.pct50_60',
        key: 'pct_50_60'
      },
      {
        id: 'data.bonusCenter.pct60_70',
        key: 'pct_60_70'
      },
      {
        id: 'data.bonusCenter.pct70_80',
        key: 'pct_70_80'
      },
      {
        id: 'data.bonusCenter.pct80_90',
        key: 'pct_80_90'
      },
      {
        id: 'data.bonusCenter.pct90_100',
        key: 'pct_90_100'
      }
    ];

    const getVals = (key: keyof UserAmountDistributionRecord) => sortedData.map(item => item[key] || 0);

    const series = [
      ...leftBarKeys.map(({ id, key }) => ({
        name: intl.formatMessage({ id }),
        type: 'bar',
        yAxisIndex: 0,
        data: getVals(key),
        emphasis: { focus: 'series' }
      })),
      ...rightLineKeys.map(({ id, key }) => ({
        name: intl.formatMessage({ id }),
        type: 'line',
        yAxisIndex: 1,
        data: getVals(key),
        smooth: true,
        emphasis: { focus: 'series' }
      }))
    ];

    // 默认展示的系列
    const defaultShownIds = [
      'data.bonusCenter.userCnt',
      'data.bonusCenter.silverCoin',
      'data.bonusCenter.pct0',
      'data.bonusCenter.pct0_10',
      'data.bonusCenter.pct10_20',
      'data.bonusCenter.pct20_30',
      'data.bonusCenter.pct30_40'
    ];

    const legendSelected = Object.fromEntries(
      [...leftBarKeys, ...rightLineKeys].map(({ id }) => [intl.formatMessage({ id }), defaultShownIds.includes(id)])
    );

    const legendRow1 = defaultShownIds.map(id => intl.formatMessage({ id }));

    const legendAll = [...leftBarKeys, ...rightLineKeys].map(({ id }) => intl.formatMessage({ id }));
    const legendRow2 = legendAll.filter(name => !legendRow1.includes(name));

    return {
      ranges: sortedData.map(item => item.amount_range),
      series,
      legendSelected,
      legendRow1,
      legendRow2
    };
  }, [data, intl]);

  if (!chartData) {
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
      <ProCard
        title={
          <div className="flex items-center gap-2">
            <div>
              <FormattedMessage id="common.base.chart" />
            </div>
          </div>
        }
      >
        <ReactECharts
          className="w-full"
          option={{
            tooltip: echartsConfig.tooltipAxis,
            legend: [
              {
                top: -5,
                type: 'plain',
                orient: 'horizontal',
                left: 'center',
                data: chartData.legendRow1,
                selected: chartData.legendSelected
              },
              {
                top: 20,
                type: 'plain',
                orient: 'horizontal',
                left: 'center',
                data: chartData.legendRow2,
                selected: chartData.legendSelected
              }
            ],
            grid: {
              ...echartsConfig.grid,
              top: 80,
              left: 100,
              bottom: 20,
              right: 80
            },
            color: echartsConfig.colors,
            xAxis: {
              type: 'category',
              data: chartData.ranges,
              position: 'left',
              axisLabel: {
                ...echartsConfig.axisLabelSmall
              },
              axisPointer: {
                type: 'shadow'
              }
            },
            yAxis: [
              {
                type: 'value',
                name: intl.formatMessage({
                  id: 'data.bonusCenter.userCnt'
                }),
                position: 'left',
                axisLabel: echartsConfig.axisLabelSmall
              },
              {
                type: 'value',
                name: intl.formatMessage({
                  id: 'data.bonusCenter.silverCoin'
                }),
                position: 'right',
                axisLabel: echartsConfig.axisLabelSmall
              }
            ],
            series: chartData.series
          }}
        />
      </ProCard>
    </Spin>
  );
});
