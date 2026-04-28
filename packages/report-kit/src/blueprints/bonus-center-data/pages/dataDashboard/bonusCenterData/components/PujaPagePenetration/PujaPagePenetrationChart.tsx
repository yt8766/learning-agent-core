// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { PujaPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';

export interface PujaPagePenetrationChartProps {
  data: PujaPagePenetrationRecord[];
  loading?: boolean;
}

export const PujaPagePenetrationChart = memo(({ data, loading }: PujaPagePenetrationChartProps) => {
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
      key: keyof PujaPagePenetrationRecord;
    }> = [
      {
        id: 'data.bonusCenter.freePageExposureUserCnt',
        key: 'free_page_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.freePagePrayClickUserCnt',
        key: 'free_page_pray_click_user_cnt'
      },
      {
        id: 'data.bonusCenter.secondPageExposureUserCnt',
        key: 'second_page_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.secondPageOfferClickUserCnt',
        key: 'second_page_offer_click_user_cnt'
      },
      {
        id: 'data.bonusCenter.guidancePageExposureUserCnt',
        key: 'guidance_page_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.guidancePageShareClickUserCnt',
        key: 'guidance_page_share_click_user_cnt'
      }
    ];

    // 右轴：百分比指标（折线图）
    const rightLineKeys: Array<{
      id: string;
      key: keyof PujaPagePenetrationRecord;
    }> = [
      {
        id: 'data.bonusCenter.freePagePrayClickUserPercent',
        key: 'free_page_pray_click_user_percent'
      },
      {
        id: 'data.bonusCenter.secondPageOfferClickUserPercent',
        key: 'second_page_offer_click_user_percent'
      },
      {
        id: 'data.bonusCenter.guidancePageShareClickUserPercent',
        key: 'guidance_page_share_click_user_percent'
      }
    ];

    const getVals = (key: keyof PujaPagePenetrationRecord) => sortedData.map(item => item[key] || 0);

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
      'data.bonusCenter.freePageExposureUserCnt',
      'data.bonusCenter.freePagePrayClickUserCnt',
      'data.bonusCenter.secondPageExposureUserCnt',
      'data.bonusCenter.guidancePageExposureUserCnt',
      'data.bonusCenter.freePagePrayClickUserPercent',
      'data.bonusCenter.secondPageOfferClickUserPercent'
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
