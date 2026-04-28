// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import type { ExchangeMallRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, type IntlShape, useIntl } from 'react-intl';
import { Col, Empty, Row, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import { EXCHANGE_MALL_CHART_GROUP_IDS, EXCHANGE_MALL_CHART_KEYS } from './exchange-mall-chart.keys';

export interface ExchangeMallChartProps {
  data: ExchangeMallRecord[];
  loading?: boolean;
}

// 单个图表组件
const SingleChart = memo(
  ({
    title,
    sortedData,
    keys,
    intl
  }: {
    title: string;
    sortedData: ExchangeMallRecord[];
    keys: Array<{ id: string; key: keyof ExchangeMallRecord }>;
    intl: IntlShape;
  }) => {
    const getVals = (key: keyof ExchangeMallRecord) => sortedData.map(item => item[key] || 0);

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
  }
);

export const ExchangeMallChart = memo(({ data, loading }: ExchangeMallChartProps) => {
  const intl = useIntl();

  const chartConfig = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const sortedData = [...data].sort((a, b) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    const chartGroups = EXCHANGE_MALL_CHART_GROUP_IDS.map(({ titleId, prefix }) => ({
      title: intl.formatMessage({ id: titleId }),
      keys: EXCHANGE_MALL_CHART_KEYS.filter(({ key }) => (key as string).startsWith(prefix))
    })).filter(group => group.keys.length > 0);

    return { sortedData, chartGroups };
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
        {/* 第一行：道具、金币 */}
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

        {/* 第二行：游戏券、试看券 */}
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

        {/* 第三行：象神、系统回收 */}
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

        {/* 第四行：付费post总 */}
        <SingleChart
          title={chartConfig.chartGroups[6]?.title || ''}
          sortedData={chartConfig.sortedData}
          keys={chartConfig.chartGroups[6]?.keys || []}
          intl={intl}
        />

        {/* 第五行：付费post 1-4档 */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <SingleChart
              title={chartConfig.chartGroups[7]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[7]?.keys || []}
              intl={intl}
            />
          </Col>
          <Col span={12}>
            <SingleChart
              title={chartConfig.chartGroups[8]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[8]?.keys || []}
              intl={intl}
            />
          </Col>
          <Col span={12}>
            <SingleChart
              title={chartConfig.chartGroups[9]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[9]?.keys || []}
              intl={intl}
            />
          </Col>
          <Col span={12}>
            <SingleChart
              title={chartConfig.chartGroups[10]?.title || ''}
              sortedData={chartConfig.sortedData}
              keys={chartConfig.chartGroups[10]?.keys || []}
              intl={intl}
            />
          </Col>
        </Row>
      </div>
    </Spin>
  );
});
