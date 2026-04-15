// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { TaskCompleteRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Empty, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';

export interface TaskCompleteChartProps {
  data: TaskCompleteRecord[];
  loading?: boolean;
}

export const TaskCompleteChart = memo(({ data, loading }: TaskCompleteChartProps) => {
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
      key: keyof TaskCompleteRecord;
    }> = [
      {
        id: 'data.bonusCenter.pujaOneStageExposureUserCnt',
        key: 'puja_one_stage_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.pujaOneStageCompleteUserCnt',
        key: 'puja_one_stage_complete_user_cnt'
      },
      {
        id: 'data.bonusCenter.pujaTwoStageExposureUserCnt',
        key: 'puja_two_stage_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.pujaTwoStageCompleteUserCnt',
        key: 'puja_two_stage_complete_user_cnt'
      },
      {
        id: 'data.bonusCenter.pujaThreeStageExposureUserCnt',
        key: 'puja_three_stage_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.pujaThreeStageCompleteUserCnt',
        key: 'puja_three_stage_complete_user_cnt'
      },
      {
        id: 'data.bonusCenter.shareLiveExposureUserCnt',
        key: 'share_live_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.shareLiveCompleteUserCnt',
        key: 'share_live_complete_user_cnt'
      },
      {
        id: 'data.bonusCenter.sharePostExposureUserCnt',
        key: 'share_post_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.sharePostCompleteUserCnt',
        key: 'share_post_complete_user_cnt'
      },
      {
        id: 'data.bonusCenter.commentPostsExposureUserCnt',
        key: 'comment_posts_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.commentPostsCompleteUserCnt',
        key: 'comment_posts_complete_user_cnt'
      },
      {
        id: 'data.bonusCenter.viewGamePageExposureUserCnt',
        key: 'view_game_page_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.viewGamePageCompleteUserCnt',
        key: 'view_game_page_complete_user_cnt'
      },
      {
        id: 'data.bonusCenter.followUserExposureUserCnt',
        key: 'follow_user_exposure_user_cnt'
      },
      {
        id: 'data.bonusCenter.followUserCompleteUserCnt',
        key: 'follow_user_complete_user_cnt'
      }
    ];

    // 右轴：百分比指标（折线图）
    const rightLineKeys: Array<{
      id: string;
      key: keyof TaskCompleteRecord;
    }> = [
      {
        id: 'data.bonusCenter.pujaOneStageCompletePercent',
        key: 'puja_one_stage_complete_percent'
      },
      {
        id: 'data.bonusCenter.pujaTwoStageCompletePercent',
        key: 'puja_two_stage_complete_percent'
      },
      {
        id: 'data.bonusCenter.pujaThreeStageCompletePercent',
        key: 'puja_three_stage_complete_percent'
      },
      {
        id: 'data.bonusCenter.shareLiveCompletePercent',
        key: 'share_live_complete_percent'
      },
      {
        id: 'data.bonusCenter.sharePostCompletePercent',
        key: 'share_post_complete_percent'
      },
      {
        id: 'data.bonusCenter.commentPostsCompletePercent',
        key: 'comment_posts_complete_percent'
      },
      {
        id: 'data.bonusCenter.viewGamePageCompletePercent',
        key: 'view_game_page_complete_percent'
      },
      {
        id: 'data.bonusCenter.followUserCompletePercent',
        key: 'follow_user_complete_percent'
      }
    ];

    const getVals = (key: keyof TaskCompleteRecord) => sortedData.map(item => item[key] || 0);

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
      'data.bonusCenter.pujaOneStageExposureUserCnt',
      'data.bonusCenter.pujaOneStageCompleteUserCnt',
      'data.bonusCenter.pujaTwoStageExposureUserCnt',
      'data.bonusCenter.pujaTwoStageCompleteUserCnt',
      'data.bonusCenter.pujaOneStageCompletePercent',
      'data.bonusCenter.pujaTwoStageCompletePercent'
    ];

    const legendSelected = Object.fromEntries(
      [...leftBarKeys, ...rightLineKeys].map(({ id }) => [intl.formatMessage({ id }), defaultShownIds.includes(id)])
    );

    const legendRow1 = defaultShownIds.map(id => intl.formatMessage({ id }));

    const legendAll = [...leftBarKeys, ...rightLineKeys].map(({ id }) => intl.formatMessage({ id }));
    const remainingLegends = legendAll.filter(name => !legendRow1.includes(name));
    // 将剩余的图例分成两列
    const midPoint = Math.ceil(remainingLegends.length / 2);
    const legendRow2 = remainingLegends.slice(0, midPoint);
    const legendRow3 = remainingLegends.slice(midPoint);

    return {
      dates: sortedData.map(item => item.dt),
      series,
      legendSelected,
      legendRow1,
      legendRow2,
      legendRow3
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
              },
              {
                top: 45,
                type: 'plain',
                orient: 'horizontal',
                left: 'center',
                data: chartData.legendRow3,
                selected: chartData.legendSelected
              }
            ],
            grid: { ...echartsConfig.grid, top: 100 },
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
