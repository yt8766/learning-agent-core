// @ts-nocheck
import { TaskPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface TaskPagePenetrationMetricsProps {
  data: TaskPagePenetrationRecord[];
  loading?: boolean;
}

export const TaskPagePenetrationMetrics = memo(({ data, loading }: TaskPagePenetrationMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalLoginDau: 0,
        totalBcBothUserCnt: 0,
        avgBcBothUserPercent: 0,
        totalPageExposureUserCnt: 0,
        totalModuleExposureUserCnt: 0,
        totalButtonClickUserCnt: 0,
        totalInviteClickUserCnt: 0,
        totalTaskButtonClickUserCnt: 0,
        avgPageExposureUserPercent: 0,
        avgModuleExposureUserPercent: 0,
        avgButtonClickUserPercent: 0,
        avgTaskButtonClickUserPercent: 0,
        avgInviteClickUserPercent: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        totalLoginDau: acc.totalLoginDau + (item.login_dau || 0),
        totalBcBothUserCnt: acc.totalBcBothUserCnt + (item.bc_both_user_cnt || 0),
        totalBcBothUserPercent: acc.totalBcBothUserPercent + (item.bc_both_user_percent || 0),
        totalPageExposureUserCnt: acc.totalPageExposureUserCnt + (item.page_exposure_user_cnt || 0),
        totalModuleExposureUserCnt: acc.totalModuleExposureUserCnt + (item.module_exposure_user_cnt || 0),
        totalButtonClickUserCnt: acc.totalButtonClickUserCnt + (item.button_click_user_cnt || 0),
        totalInviteClickUserCnt: acc.totalInviteClickUserCnt + (item.invite_click_user_cnt || 0),
        totalTaskButtonClickUserCnt: acc.totalTaskButtonClickUserCnt + (item.task_button_click_user_cnt || 0),
        totalPageExposureUserPercent: acc.totalPageExposureUserPercent + (item.page_exposure_user_percent || 0),
        totalModuleExposureUserPercent: acc.totalModuleExposureUserPercent + (item.module_exposure_user_percent || 0),
        totalButtonClickUserPercent: acc.totalButtonClickUserPercent + (item.button_click_user_percent || 0),
        totalTaskButtonClickUserPercent:
          acc.totalTaskButtonClickUserPercent + (item.task_button_click_user_percent || 0),
        totalInviteClickUserPercent: acc.totalInviteClickUserPercent + (item.invite_click_user_percent || 0)
      }),
      {
        totalLoginDau: 0,
        totalBcBothUserCnt: 0,
        totalBcBothUserPercent: 0,
        totalPageExposureUserCnt: 0,
        totalModuleExposureUserCnt: 0,
        totalButtonClickUserCnt: 0,
        totalInviteClickUserCnt: 0,
        totalTaskButtonClickUserCnt: 0,
        totalPageExposureUserPercent: 0,
        totalModuleExposureUserPercent: 0,
        totalButtonClickUserPercent: 0,
        totalTaskButtonClickUserPercent: 0,
        totalInviteClickUserPercent: 0
      }
    );

    // 计算平均值
    const count = data.length;
    return {
      totalLoginDau: totals.totalLoginDau,
      totalBcBothUserCnt: totals.totalBcBothUserCnt,
      avgBcBothUserPercent: count > 0 ? totals.totalBcBothUserPercent / count : 0,
      totalPageExposureUserCnt: totals.totalPageExposureUserCnt,
      totalModuleExposureUserCnt: totals.totalModuleExposureUserCnt,
      totalButtonClickUserCnt: totals.totalButtonClickUserCnt,
      totalInviteClickUserCnt: totals.totalInviteClickUserCnt,
      totalTaskButtonClickUserCnt: totals.totalTaskButtonClickUserCnt,
      avgPageExposureUserPercent: count > 0 ? totals.totalPageExposureUserPercent / count : 0,
      avgModuleExposureUserPercent: count > 0 ? totals.totalModuleExposureUserPercent / count : 0,
      avgButtonClickUserPercent: count > 0 ? totals.totalButtonClickUserPercent / count : 0,
      avgTaskButtonClickUserPercent: count > 0 ? totals.totalTaskButtonClickUserPercent / count : 0,
      avgInviteClickUserPercent: count > 0 ? totals.totalInviteClickUserPercent / count : 0
    };
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.taskPagePenetrationMetrics" />} loading={loading} bordered>
      <Row gutter={[16, 16]}>
        {/* 人数指标 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.loginDau" />}
              value={formatNumber(metrics.totalLoginDau)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.bcBothUserCnt" />}
              value={formatNumber(metrics.totalBcBothUserCnt)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pageExposureUserCnt" />}
              value={formatNumber(metrics.totalPageExposureUserCnt)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.moduleExposureUserCnt" />}
              value={formatNumber(metrics.totalModuleExposureUserCnt)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.buttonClickUserCnt" />}
              value={formatNumber(metrics.totalButtonClickUserCnt)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inviteClickUserCnt" />}
              value={formatNumber(metrics.totalInviteClickUserCnt)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.taskButtonClickUserCnt" />}
              value={formatNumber(metrics.totalTaskButtonClickUserCnt)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>

        {/* 百分比指标 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.bcBothUserPercent" />}
              value={formatPercentage(metrics.avgBcBothUserPercent)}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pageExposureUserPercent" />}
              value={formatPercentage(metrics.avgPageExposureUserPercent)}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.moduleExposureUserPercent" />}
              value={formatPercentage(metrics.avgModuleExposureUserPercent)}
              valueStyle={{ color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.buttonClickUserPercent" />}
              value={formatPercentage(metrics.avgButtonClickUserPercent)}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.taskButtonClickUserPercent" />}
              value={formatPercentage(metrics.avgTaskButtonClickUserPercent)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inviteClickUserPercent" />}
              value={formatPercentage(metrics.avgInviteClickUserPercent)}
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
