// @ts-nocheck
import { echartsConfig } from '@/config/layout';
import { ExchangeMallRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage, type IntlShape, useIntl } from 'react-intl';
import { Col, Empty, Row, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';

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

    // 按日期排序
    const sortedData = [...data].sort((a, b) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    // 定义所有字段
    const allKeys: Array<{
      id: string;
      key: keyof ExchangeMallRecord;
    }> = [
      {
        id: 'data.bonusCenter.propsAllCnt',
        key: 'props_all_cnt'
      },
      {
        id: 'data.bonusCenter.propsAmount',
        key: 'props_amount'
      },
      {
        id: 'data.bonusCenter.propsUserCnt',
        key: 'props_user_cnt'
      },
      {
        id: 'data.bonusCenter.coinAllCnt',
        key: 'coin_all_cnt'
      },
      {
        id: 'data.bonusCenter.coinAmount',
        key: 'coin_amount'
      },
      {
        id: 'data.bonusCenter.coinAssetAmount',
        key: 'coin_asset_amount'
      },
      {
        id: 'data.bonusCenter.coinUserCnt',
        key: 'coin_user_cnt'
      },
      {
        id: 'data.bonusCenter.voucherAllCnt',
        key: 'voucher_all_cnt'
      },
      {
        id: 'data.bonusCenter.voucherAmount',
        key: 'voucher_amount'
      },
      {
        id: 'data.bonusCenter.voucherUserCnt',
        key: 'voucher_user_cnt'
      },
      {
        id: 'data.bonusCenter.vipVoucherAllCnt',
        key: 'vip_voucher_all_cnt'
      },
      {
        id: 'data.bonusCenter.vipVoucherAmount',
        key: 'vip_voucher_amount'
      },
      {
        id: 'data.bonusCenter.vipVoucherUserCnt',
        key: 'vip_voucher_user_cnt'
      },
      {
        id: 'data.bonusCenter.pujaAllCnt',
        key: 'puja_all_cnt'
      },
      {
        id: 'data.bonusCenter.pujaAmount',
        key: 'puja_amount'
      },
      {
        id: 'data.bonusCenter.pujaUserCnt',
        key: 'puja_user_cnt'
      },
      {
        id: 'data.bonusCenter.systemRetrieveAllCnt',
        key: 'system_retrieve_all_cnt'
      },
      {
        id: 'data.bonusCenter.systemRetrieveAmount',
        key: 'system_retrieve_amount'
      },
      {
        id: 'data.bonusCenter.systemRetrieveUserCnt',
        key: 'system_retrieve_user_cnt'
      },
      {
        id: 'data.bonusCenter.postTotalAllCnt',
        key: 'post_total_all_cnt'
      },
      {
        id: 'data.bonusCenter.postTotalAmount',
        key: 'post_total_amount'
      },
      {
        id: 'data.bonusCenter.postTotalUserCnt',
        key: 'post_total_user_cnt'
      },
      {
        id: 'data.bonusCenter.post1AllCnt',
        key: 'post_1_all_cnt'
      },
      {
        id: 'data.bonusCenter.post1Amount',
        key: 'post_1_amount'
      },
      {
        id: 'data.bonusCenter.post1UserCnt',
        key: 'post_1_user_cnt'
      },
      {
        id: 'data.bonusCenter.post2AllCnt',
        key: 'post_2_all_cnt'
      },
      {
        id: 'data.bonusCenter.post2Amount',
        key: 'post_2_amount'
      },
      {
        id: 'data.bonusCenter.post2UserCnt',
        key: 'post_2_user_cnt'
      },
      {
        id: 'data.bonusCenter.post3AllCnt',
        key: 'post_3_all_cnt'
      },
      {
        id: 'data.bonusCenter.post3Amount',
        key: 'post_3_amount'
      },
      {
        id: 'data.bonusCenter.post3UserCnt',
        key: 'post_3_user_cnt'
      },
      {
        id: 'data.bonusCenter.post4AllCnt',
        key: 'post_4_all_cnt'
      },
      {
        id: 'data.bonusCenter.post4Amount',
        key: 'post_4_amount'
      },
      {
        id: 'data.bonusCenter.post4UserCnt',
        key: 'post_4_user_cnt'
      }
    ];

    // 按业务逻辑分组
    const chartGroups = [
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.propsAllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('props_'))
      },
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.coinAllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('coin_'))
      },
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.voucherAllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('voucher_'))
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.vipVoucherAllCnt'
        }),
        keys: allKeys.filter(({ key }) => key.startsWith('vip_voucher_'))
      },
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.pujaAllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('puja_'))
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.systemRetrieveAllCnt'
        }),
        keys: allKeys.filter(({ key }) => key.startsWith('system_retrieve_'))
      },
      {
        title: intl.formatMessage({
          id: 'data.bonusCenter.postTotalAllCnt'
        }),
        keys: allKeys.filter(({ key }) => key.startsWith('post_total_'))
      },
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.post1AllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('post_1_'))
      },
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.post2AllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('post_2_'))
      },
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.post3AllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('post_3_'))
      },
      {
        title: intl.formatMessage({ id: 'data.bonusCenter.post4AllCnt' }),
        keys: allKeys.filter(({ key }) => key.startsWith('post_4_'))
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
