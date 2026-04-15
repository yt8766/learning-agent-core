// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { TaskPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';

export interface TaskPagePenetrationChartProps {
  data: TaskPagePenetrationRecord[];
  loading?: boolean;
}

export const TaskPagePenetrationChart = memo(({ data, loading }: TaskPagePenetrationChartProps) => {
  const intl = useIntl();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    // 按日期排序
    const sortedData = [...data].sort((a, b) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    // 左轴：人数指标（柱状图）
    const leftBarKeys: Array<{
      id: string;
      key: keyof TaskPagePenetrationRecord;
    }> = [
      {
        id: 'data.bonusCenter.loginDau',
        key: 'login_dau'
      },
      {
        id: 'data.bonusCenter.bcBothUserCnt',
        key: 'bc_both_user_cnt'
      },
      {
        id: 'data.bonusCenter.pageExposureUserCnt',
        key: 'page_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.moduleExposureUserCnt',
        key: 'module_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.buttonClickUserCnt',
        key: 'button_click_user_cnt'
      },
      {
        id: 'data.bonusCenter.inviteClickUserCnt',
        key: 'invite_click_user_cnt'
      },
      {
        id: 'data.bonusCenter.taskButtonClickUserCnt',
        key: 'task_button_click_user_cnt'
      }
    ];

    // 右轴：百分比指标（折线图）
    const rightLineKeys: Array<{
      id: string;
      key: keyof TaskPagePenetrationRecord;
    }> = [
      {
        id: 'data.bonusCenter.bcBothUserPercent',
        key: 'bc_both_user_percent'
      },
      {
        id: 'data.bonusCenter.pageExposureUserPercent',
        key: 'page_exposure_user_percent'
      },
      {
        id: 'data.bonusCenter.moduleExposureUserPercent',
        key: 'module_exposure_user_percent'
      },
      {
        id: 'data.bonusCenter.buttonClickUserPercent',
        key: 'button_click_user_percent'
      },
      {
        id: 'data.bonusCenter.taskButtonClickUserPercent',
        key: 'task_button_click_user_percent'
      },
      {
        id: 'data.bonusCenter.inviteClickUserPercent',
        key: 'invite_click_user_percent'
      }
    ];

    const getVals = (key: keyof TaskPagePenetrationRecord) => sortedData.map(item => item[key] || 0);

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
        data: getVals(key).map((v: string | number) => (v === null || v === undefined ? 0 : (v as number) * 100)),
        smooth: true,
        emphasis: { focus: 'series' }
      }))
    ];

    // 默认展示的系列
    const defaultShownIds = [
      'data.bonusCenter.loginDau',
      'data.bonusCenter.bcBothUserCnt',
      'data.bonusCenter.pageExposureUserCnt',
      'data.bonusCenter.moduleExposureUserCnt',
      'data.bonusCenter.buttonClickUserCnt',
      'data.bonusCenter.bcBothUserPercent',
      'data.bonusCenter.pageExposureUserPercent',
      'data.bonusCenter.moduleExposureUserPercent'
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
                  id: 'data.creatorConsumeBoard.percentage'
                }),
                position: 'right',
                axisLabel: {
                  ...echartsConfig.axisLabelSmall,
                  formatter: '{value}%'
                }
              }
            ],
            series: chartData.series
          }}
        />
      </ProCard>
    </Spin>
  );
});
