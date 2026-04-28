// @ts-nocheck
import { AmountRecordRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface AmountRecordMetricsProps {
  data: AmountRecordRecord[];
  loading?: boolean;
}

export const AmountRecordMetrics = memo(({ data, loading }: AmountRecordMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalRecordAllCnt: 0,
        totalRecordAmount: 0,
        totalRecordUserCnt: 0,
        totalRecordAmountAvg: 0,
        inviteRecordAllCnt: 0,
        inviteRecordAmount: 0,
        inviteRecordUserCnt: 0,
        inviteRecordAmountAvg: 0,
        notInviteRecordAllCnt: 0,
        notInviteRecordAmount: 0,
        notInviteRecordUserCnt: 0,
        notInviteRecordAmountAvg: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        totalRecordAllCnt: acc.totalRecordAllCnt + (item.total_record_all_cnt || 0),
        totalRecordAmount: acc.totalRecordAmount + (item.total_record_amount || 0),
        totalRecordUserCnt: acc.totalRecordUserCnt + (item.total_record_user_cnt || 0),
        totalRecordAmountAvg: acc.totalRecordAmountAvg + (item.total_record_amount_avg || 0),
        inviteRecordAllCnt: acc.inviteRecordAllCnt + (item.invite_record_all_cnt || 0),
        inviteRecordAmount: acc.inviteRecordAmount + (item.invite_record_amount || 0),
        inviteRecordUserCnt: acc.inviteRecordUserCnt + (item.invite_record_user_cnt || 0),
        inviteRecordAmountAvg: acc.inviteRecordAmountAvg + (item.invite_record_amount_avg || 0),
        notInviteRecordAllCnt: acc.notInviteRecordAllCnt + (item.not_invite_record_all_cnt || 0),
        notInviteRecordAmount: acc.notInviteRecordAmount + (item.not_invite_record_amount || 0),
        notInviteRecordUserCnt: acc.notInviteRecordUserCnt + (item.not_invite_record_user_cnt || 0),
        notInviteRecordAmountAvg: acc.notInviteRecordAmountAvg + (item.not_invite_record_amount_avg || 0)
      }),
      {
        totalRecordAllCnt: 0,
        totalRecordAmount: 0,
        totalRecordUserCnt: 0,
        totalRecordAmountAvg: 0,
        inviteRecordAllCnt: 0,
        inviteRecordAmount: 0,
        inviteRecordUserCnt: 0,
        inviteRecordAmountAvg: 0,
        notInviteRecordAllCnt: 0,
        notInviteRecordAmount: 0,
        notInviteRecordUserCnt: 0,
        notInviteRecordAmountAvg: 0
      }
    );

    // 计算平均值
    const count = data.length;
    return {
      totalRecordAllCnt: totals.totalRecordAllCnt,
      totalRecordAmount: totals.totalRecordAmount,
      totalRecordUserCnt: totals.totalRecordUserCnt,
      totalRecordAmountAvg: count > 0 ? totals.totalRecordAmountAvg / count : 0,
      inviteRecordAllCnt: totals.inviteRecordAllCnt,
      inviteRecordAmount: totals.inviteRecordAmount,
      inviteRecordUserCnt: totals.inviteRecordUserCnt,
      inviteRecordAmountAvg: count > 0 ? totals.inviteRecordAmountAvg / count : 0,
      notInviteRecordAllCnt: totals.notInviteRecordAllCnt,
      notInviteRecordAmount: totals.notInviteRecordAmount,
      notInviteRecordUserCnt: totals.notInviteRecordUserCnt,
      notInviteRecordAmountAvg: count > 0 ? totals.notInviteRecordAmountAvg / count : 0
    };
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatAmount = (num: number) => {
    return num.toLocaleString();
  };

  const formatAvgAmount = (num: number) => {
    return num.toFixed(2);
  };

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.amountRecordMetrics" />} loading={loading} bordered>
      <Row gutter={[16, 16]}>
        {/* 总发放 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.totalRecordAllCnt" />}
              value={formatNumber(metrics.totalRecordAllCnt)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.totalRecordAmount" />}
              value={formatAmount(metrics.totalRecordAmount)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.totalRecordUserCnt" />}
              value={formatNumber(metrics.totalRecordUserCnt)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.totalRecordAmountAvg" />}
              value={formatAvgAmount(metrics.totalRecordAmountAvg)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        {/* 包含邀请发放 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inviteRecordAllCnt" />}
              value={formatNumber(metrics.inviteRecordAllCnt)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inviteRecordAmount" />}
              value={formatAmount(metrics.inviteRecordAmount)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inviteRecordUserCnt" />}
              value={formatNumber(metrics.inviteRecordUserCnt)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.inviteRecordAmountAvg" />}
              value={formatAvgAmount(metrics.inviteRecordAmountAvg)}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        {/* 不包含邀请发放 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.notInviteRecordAllCnt" />}
              value={formatNumber(metrics.notInviteRecordAllCnt)}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.notInviteRecordAmount" />}
              value={formatAmount(metrics.notInviteRecordAmount)}
              valueStyle={{ color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.notInviteRecordUserCnt" />}
              value={formatNumber(metrics.notInviteRecordUserCnt)}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.notInviteRecordAmountAvg" />}
              value={formatAvgAmount(metrics.notInviteRecordAmountAvg)}
              valueStyle={{ color: '#531dab' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
