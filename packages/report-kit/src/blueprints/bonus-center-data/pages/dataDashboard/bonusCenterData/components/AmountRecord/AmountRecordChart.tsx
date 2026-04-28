// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { AmountRecordRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { useIntl } from 'react-intl';
import { Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';

export interface AmountRecordChartProps {
  data: AmountRecordRecord[];
  loading?: boolean;
}

export const AmountRecordChart = memo(({ data, loading }: AmountRecordChartProps) => {
  const intl = useIntl();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    // 按日期排序
    const sortedData = [...data].sort((a, b) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    // 左轴：次数、金额、人数指标（柱状图）
    const leftBarKeys: Array<{
      id: string;
      key: keyof AmountRecordRecord;
    }> = [
      {
        id: 'data.bonusCenter.totalRecordAllCnt',
        key: 'total_record_all_cnt'
      },
      {
        id: 'data.bonusCenter.totalRecordAmount',
        key: 'total_record_amount'
      },
      {
        id: 'data.bonusCenter.totalRecordUserCnt',
        key: 'total_record_user_cnt'
      },
      {
        id: 'data.bonusCenter.inviteRecordAllCnt',
        key: 'invite_record_all_cnt'
      },
      {
        id: 'data.bonusCenter.inviteRecordAmount',
        key: 'invite_record_amount'
      },
      {
        id: 'data.bonusCenter.inviteRecordUserCnt',
        key: 'invite_record_user_cnt'
      },
      {
        id: 'data.bonusCenter.notInviteRecordAllCnt',
        key: 'not_invite_record_all_cnt'
      },
      {
        id: 'data.bonusCenter.notInviteRecordAmount',
        key: 'not_invite_record_amount'
      },
      {
        id: 'data.bonusCenter.notInviteRecordUserCnt',
        key: 'not_invite_record_user_cnt'
      }
    ];

    // 右轴：人均金额指标（折线图）
    const rightLineKeys: Array<{
      id: string;
      key: keyof AmountRecordRecord;
    }> = [
      {
        id: 'data.bonusCenter.totalRecordAmountAvg',
        key: 'total_record_amount_avg'
      },
      {
        id: 'data.bonusCenter.inviteRecordAmountAvg',
        key: 'invite_record_amount_avg'
      },
      {
        id: 'data.bonusCenter.notInviteRecordAmountAvg',
        key: 'not_invite_record_amount_avg'
      }
    ];

    const getVals = (key: keyof AmountRecordRecord) => sortedData.map(item => item[key] || 0);

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
      'data.bonusCenter.totalRecordAllCnt',
      'data.bonusCenter.totalRecordAmount',
      'data.bonusCenter.totalRecordUserCnt',
      'data.bonusCenter.inviteRecordAllCnt',
      'data.bonusCenter.inviteRecordAmount',
      'data.bonusCenter.totalRecordAmountAvg',
      'data.bonusCenter.inviteRecordAmountAvg'
    ];

    const legendSelected = Object.fromEntries(
      [...leftBarKeys, ...rightLineKeys].map(({ id }) => [intl.formatMessage({ id }), defaultShownIds.includes(id)])
    );

    const legendRow1 = defaultShownIds.map(id => intl.formatMessage({ id }));

    const legendAll = [...leftBarKeys, ...rightLineKeys].map(({ id }) => intl.formatMessage({ id }));
    const legendRow2 = legendAll.filter(name => !legendRow1.includes(name));

    return {
      dates: sortedData.map(item => item.dt),
      series,
      legendSelected,
      legendRow1,
      legendRow2
    };
  }, [data, intl]);

  if (!chartData) {
    return (
      <Spin spinning={loading}>
        <ProCard>
          <Empty description={intl.formatMessage({ id: 'common.status.noData' })} />
        </ProCard>
      </Spin>
    );
  }

  return (
    <Spin spinning={loading}>
      <ProCard>
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
            grid: { ...echartsConfig.grid, top: 80 },
            color: echartsConfig.colors,
            xAxis: {
              type: 'category',
              data: chartData.dates,
              position: 'left',
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
              },
              {
                type: 'value',
                name: intl.formatMessage({
                  id: 'data.bonusCenter.avgAmount'
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
