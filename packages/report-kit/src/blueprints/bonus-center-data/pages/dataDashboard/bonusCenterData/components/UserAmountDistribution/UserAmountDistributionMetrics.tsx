// @ts-nocheck
import { UserAmountDistributionRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface UserAmountDistributionMetricsProps {
  data: UserAmountDistributionRecord[];
  loading?: boolean;
}

export const UserAmountDistributionMetrics = memo(({ data, loading }: UserAmountDistributionMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalUserCnt: 0,
        totalSilverCoin: 0,
        totalPct0: 0,
        totalPct0_10: 0,
        totalPct10_20: 0,
        totalPct20_30: 0,
        totalPct30_40: 0,
        totalPct40_50: 0,
        totalPct50_60: 0,
        totalPct60_70: 0,
        totalPct70_80: 0,
        totalPct80_90: 0,
        totalPct90_100: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        totalUserCnt: acc.totalUserCnt + (item.user_cnt || 0),
        totalSilverCoin: acc.totalSilverCoin + (item.silver_coin || 0),
        totalPct0: acc.totalPct0 + (item.pct_0 || 0),
        totalPct0_10: acc.totalPct0_10 + (item.pct_0_10 || 0),
        totalPct10_20: acc.totalPct10_20 + (item.pct_10_20 || 0),
        totalPct20_30: acc.totalPct20_30 + (item.pct_20_30 || 0),
        totalPct30_40: acc.totalPct30_40 + (item.pct_30_40 || 0),
        totalPct40_50: acc.totalPct40_50 + (item.pct_40_50 || 0),
        totalPct50_60: acc.totalPct50_60 + (item.pct_50_60 || 0),
        totalPct60_70: acc.totalPct60_70 + (item.pct_60_70 || 0),
        totalPct70_80: acc.totalPct70_80 + (item.pct_70_80 || 0),
        totalPct80_90: acc.totalPct80_90 + (item.pct_80_90 || 0),
        totalPct90_100: acc.totalPct90_100 + (item.pct_90_100 || 0)
      }),
      {
        totalUserCnt: 0,
        totalSilverCoin: 0,
        totalPct0: 0,
        totalPct0_10: 0,
        totalPct10_20: 0,
        totalPct20_30: 0,
        totalPct30_40: 0,
        totalPct40_50: 0,
        totalPct50_60: 0,
        totalPct60_70: 0,
        totalPct70_80: 0,
        totalPct80_90: 0,
        totalPct90_100: 0
      }
    );

    return totals;
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <ProCard
      title={<FormattedMessage id="data.bonusCenter.userAmountDistributionMetrics" />}
      loading={loading}
      bordered
    >
      <Row gutter={[16, 16]}>
        {/* 核心指标 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.userCnt" />}
              value={formatNumber(metrics.totalUserCnt)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.silverCoin" />}
              value={formatNumber(metrics.totalSilverCoin)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        {/* 消耗百分比指标 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct0" />}
              value={formatNumber(metrics.totalPct0)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct0_10" />}
              value={formatNumber(metrics.totalPct0_10)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct10_20" />}
              value={formatNumber(metrics.totalPct10_20)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct20_30" />}
              value={formatNumber(metrics.totalPct20_30)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct30_40" />}
              value={formatNumber(metrics.totalPct30_40)}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct40_50" />}
              value={formatNumber(metrics.totalPct40_50)}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct50_60" />}
              value={formatNumber(metrics.totalPct50_60)}
              valueStyle={{ color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct60_70" />}
              value={formatNumber(metrics.totalPct60_70)}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct70_80" />}
              value={formatNumber(metrics.totalPct70_80)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct80_90" />}
              value={formatNumber(metrics.totalPct80_90)}
              valueStyle={{ color: '#ad2102' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pct90_100" />}
              value={formatNumber(metrics.totalPct90_100)}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
