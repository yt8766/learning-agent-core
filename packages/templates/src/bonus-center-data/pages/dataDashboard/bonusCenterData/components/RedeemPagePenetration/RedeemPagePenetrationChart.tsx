// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { RedeemPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';

export interface RedeemPagePenetrationChartProps {
  data: RedeemPagePenetrationRecord[];
  loading?: boolean;
}

export const RedeemPagePenetrationChart = memo(({ data, loading }: RedeemPagePenetrationChartProps) => {
  const intl = useIntl();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    // 按日期排序
    const sortedData = [...data].sort((a, b) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    // 所有指标都是人数，使用柱状图
    const barKeys: Array<{
      id: string;
      key: keyof RedeemPagePenetrationRecord;
    }> = [
      {
        id: 'data.bonusCenter.pageExposureUserCnt',
        key: 'page_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.promptModuleExposureUserCnt',
        key: 'prompt_module_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.tabModuleExposureUserCnt',
        key: 'tab_module_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.itemListModuleExposureUserCnt',
        key: 'item_list_module_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.claimButtonClickUserCnt',
        key: 'claim_button_click_user_cnt'
      },
      {
        id: 'data.bonusCenter.tabSwitchClickUserCnt',
        key: 'tab_switch_click_user_cnt'
      },
      {
        id: 'data.bonusCenter.itemButtonClickUserCnt',
        key: 'item_button_click_user_cnt'
      }
    ];

    const getVals = (key: keyof RedeemPagePenetrationRecord) => sortedData.map(item => item[key] || 0);

    const series = barKeys.map(({ id, key }) => ({
      name: intl.formatMessage({ id }),
      type: 'bar',
      yAxisIndex: 0,
      data: getVals(key),
      emphasis: { focus: 'series' }
    }));

    // 默认展示的系列
    const defaultShownIds = [
      'data.bonusCenter.pageExposureUserCnt',
      'data.bonusCenter.promptModuleExposureUserCnt',
      'data.bonusCenter.tabModuleExposureUserCnt',
      'data.bonusCenter.claimButtonClickUserCnt'
    ];

    const legendSelected = Object.fromEntries(
      barKeys.map(({ id }) => [intl.formatMessage({ id }), defaultShownIds.includes(id)])
    );

    const legendRow1 = defaultShownIds.map(id => intl.formatMessage({ id }));

    const legendAll = barKeys.map(({ id }) => intl.formatMessage({ id }));
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
              }
            ],
            series: chartData.series
          }}
        />
      </ProCard>
    </Spin>
  );
});
