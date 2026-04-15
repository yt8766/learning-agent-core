// @ts-nocheck
import { UserRemainRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface UserRemainMetricsProps {
  data: UserRemainRecord[];
  loading?: boolean;
}

export const UserRemainMetrics = memo(({ data, loading }: UserRemainMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalAllUserCnt: 0,
        avgAllUserRemain1dPercent: 0,
        avgAllUserRemain3dPercent: 0,
        avgAllUserRemain7dPercent: 0,
        totalNoBcUserCnt: 0,
        avgNoBcUserRemain1dPercent: 0,
        avgNoBcUserRemain3dPercent: 0,
        avgNoBcUserRemain7dPercent: 0,
        totalInBcUserCnt: 0,
        avgInBcUserRemain1dPercent: 0,
        avgInBcUserRemain3dPercent: 0,
        avgInBcUserRemain7dPercent: 0,
        avgInBcUserModuleRemain1dPercent: 0,
        avgInBcUserModuleRemain3dPercent: 0,
        avgInBcUserModuleRemain7dPercent: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        totalAllUserCnt: acc.totalAllUserCnt + (item.all_user_cnt || 0),
        totalAllUserRemain1dPercent: acc.totalAllUserRemain1dPercent + (item.all_user_remain_1d_percent || 0),
        totalAllUserRemain3dPercent: acc.totalAllUserRemain3dPercent + (item.all_user_remain_3d_percent || 0),
        totalAllUserRemain7dPercent: acc.totalAllUserRemain7dPercent + (item.all_user_remain_7d_percent || 0),
        totalNoBcUserCnt: acc.totalNoBcUserCnt + (item.no_bc_user_cnt || 0),
        totalNoBcUserRemain1dPercent: acc.totalNoBcUserRemain1dPercent + (item.no_bc_user_remain_1d_percent || 0),
        totalNoBcUserRemain3dPercent: acc.totalNoBcUserRemain3dPercent + (item.no_bc_user_remain_3d_percent || 0),
        totalNoBcUserRemain7dPercent: acc.totalNoBcUserRemain7dPercent + (item.no_bc_user_remain_7d_percent || 0),
        totalInBcUserCnt: acc.totalInBcUserCnt + (item.in_bc_user_cnt || 0),
        totalInBcUserRemain1dPercent: acc.totalInBcUserRemain1dPercent + (item.in_bc_user_remain_1d_percent || 0),
        totalInBcUserRemain3dPercent: acc.totalInBcUserRemain3dPercent + (item.in_bc_user_remain_3d_percent || 0),
        totalInBcUserRemain7dPercent: acc.totalInBcUserRemain7dPercent + (item.in_bc_user_remain_7d_percent || 0),
        totalInBcUserModuleRemain1dPercent:
          acc.totalInBcUserModuleRemain1dPercent + (item.in_bc_user_module_remain_1d_percent || 0),
        totalInBcUserModuleRemain3dPercent:
          acc.totalInBcUserModuleRemain3dPercent + (item.in_bc_user_module_remain_3d_percent || 0),
        totalInBcUserModuleRemain7dPercent:
          acc.totalInBcUserModuleRemain7dPercent + (item.in_bc_user_module_remain_7d_percent || 0)
      }),
      {
        totalAllUserCnt: 0,
        totalAllUserRemain1dPercent: 0,
        totalAllUserRemain3dPercent: 0,
        totalAllUserRemain7dPercent: 0,
        totalNoBcUserCnt: 0,
        totalNoBcUserRemain1dPercent: 0,
        totalNoBcUserRemain3dPercent: 0,
        totalNoBcUserRemain7dPercent: 0,
        totalInBcUserCnt: 0,
        totalInBcUserRemain1dPercent: 0,
        totalInBcUserRemain3dPercent: 0,
        totalInBcUserRemain7dPercent: 0,
        totalInBcUserModuleRemain1dPercent: 0,
        totalInBcUserModuleRemain3dPercent: 0,
        totalInBcUserModuleRemain7dPercent: 0
      }
    );

    // 计算平均值
    const count = data.length;
    return {
      totalAllUserCnt: totals.totalAllUserCnt,
      avgAllUserRemain1dPercent: count > 0 ? totals.totalAllUserRemain1dPercent / count : 0,
      avgAllUserRemain3dPercent: count > 0 ? totals.totalAllUserRemain3dPercent / count : 0,
      avgAllUserRemain7dPercent: count > 0 ? totals.totalAllUserRemain7dPercent / count : 0,
      totalNoBcUserCnt: totals.totalNoBcUserCnt,
      avgNoBcUserRemain1dPercent: count > 0 ? totals.totalNoBcUserRemain1dPercent / count : 0,
      avgNoBcUserRemain3dPercent: count > 0 ? totals.totalNoBcUserRemain3dPercent / count : 0,
      avgNoBcUserRemain7dPercent: count > 0 ? totals.totalNoBcUserRemain7dPercent / count : 0,
      totalInBcUserCnt: totals.totalInBcUserCnt,
      avgInBcUserRemain1dPercent: count > 0 ? totals.totalInBcUserRemain1dPercent / count : 0,
      avgInBcUserRemain3dPercent: count > 0 ? totals.totalInBcUserRemain3dPercent / count : 0,
      avgInBcUserRemain7dPercent: count > 0 ? totals.totalInBcUserRemain7dPercent / count : 0,
      avgInBcUserModuleRemain1dPercent: count > 0 ? totals.totalInBcUserModuleRemain1dPercent / count : 0,
      avgInBcUserModuleRemain3dPercent: count > 0 ? totals.totalInBcUserModuleRemain3dPercent / count : 0,
      avgInBcUserModuleRemain7dPercent: count > 0 ? totals.totalInBcUserModuleRemain7dPercent / count : 0
    };
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.userRemainMetrics" />} loading={loading} bordered>
      <Row gutter={[16, 16]}>
        {/* 总用户 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.allUserCnt" />}
              value={formatNumber(metrics.totalAllUserCnt)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.allUserRemain1dPercent" />}
              value={formatPercentage(metrics.avgAllUserRemain1dPercent)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.allUserRemain3dPercent" />}
              value={formatPercentage(metrics.avgAllUserRemain3dPercent)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.allUserRemain7dPercent" />}
              value={formatPercentage(metrics.avgAllUserRemain7dPercent)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        {/* 无bc渗透用户 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.noBcUserCnt" />}
              value={formatNumber(metrics.totalNoBcUserCnt)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.noBcUserRemain1dPercent" />}
              value={formatPercentage(metrics.avgNoBcUserRemain1dPercent)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.noBcUserRemain3dPercent" />}
              value={formatPercentage(metrics.avgNoBcUserRemain3dPercent)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.noBcUserRemain7dPercent" />}
              value={formatPercentage(metrics.avgNoBcUserRemain7dPercent)}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        {/* bc渗透用户 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inBcUserCnt" />}
              value={formatNumber(metrics.totalInBcUserCnt)}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inBcUserRemain1dPercent" />}
              value={formatPercentage(metrics.avgInBcUserRemain1dPercent)}
              valueStyle={{ color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inBcUserRemain3dPercent" />}
              value={formatPercentage(metrics.avgInBcUserRemain3dPercent)}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inBcUserRemain7dPercent" />}
              value={formatPercentage(metrics.avgInBcUserRemain7dPercent)}
              valueStyle={{ color: '#531dab' }}
            />
          </Card>
        </Col>
        {/* bc渗透用户功能留存 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inBcUserModuleRemain1dPercent" />}
              value={formatPercentage(metrics.avgInBcUserModuleRemain1dPercent)}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inBcUserModuleRemain3dPercent" />}
              value={formatPercentage(metrics.avgInBcUserModuleRemain3dPercent)}
              valueStyle={{ color: '#a0d911' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small">
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inBcUserModuleRemain7dPercent" />}
              value={formatPercentage(metrics.avgInBcUserModuleRemain7dPercent)}
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
