// @ts-nocheck
import { CostAnalysisRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface CostAnalysisMetricsProps {
  data: CostAnalysisRecord[];
  loading?: boolean;
}

export const CostAnalysisMetrics = memo(({ data, loading }: CostAnalysisMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        exchangeCoinUserCnt: 0,
        exchangeCoinAmount: 0,
        inviteUserCnt: 0,
        avgInviteCost: 0,
        rechargeAmount: 0,
        liveAmount: 0,
        liveTransferAmount: 0,
        postAmount: 0,
        postTransferAmount: 0,
        gameAllBetAmount: 0,
        gameVoucherDiffAmount: 0,
        gameAllDiffAmount: 0,
        withdrawalAmount: 0,
        systemStockAmount: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        exchangeCoinUserCnt: acc.exchangeCoinUserCnt + (item.exchange_coin_user_cnt || 0),
        exchangeCoinAmount: acc.exchangeCoinAmount + (item.exchange_coin_amount || 0),
        inviteUserCnt: acc.inviteUserCnt + (item.invite_user_cnt || 0),
        avgInviteCost: acc.avgInviteCost + (item.avg_invite_cost || 0),
        rechargeAmount: acc.rechargeAmount + (item.recharge_amount || 0),
        liveAmount: acc.liveAmount + (item.live_amount || 0),
        liveTransferAmount: acc.liveTransferAmount + (item.live_transfer_amount || 0),
        postAmount: acc.postAmount + (item.post_amount || 0),
        postTransferAmount: acc.postTransferAmount + (item.post_transfer_amount || 0),
        gameAllBetAmount: acc.gameAllBetAmount + (item.game_all_bet_amount || 0),
        gameVoucherDiffAmount: acc.gameVoucherDiffAmount + (item.game_voucher_diff_amount || 0),
        gameAllDiffAmount: acc.gameAllDiffAmount + (item.game_all_diff_amount || 0),
        withdrawalAmount: acc.withdrawalAmount + (item.withdrawal_amount || 0),
        systemStockAmount: acc.systemStockAmount + (item.system_stock_amount || 0)
      }),
      {
        exchangeCoinUserCnt: 0,
        exchangeCoinAmount: 0,
        inviteUserCnt: 0,
        avgInviteCost: 0,
        rechargeAmount: 0,
        liveAmount: 0,
        liveTransferAmount: 0,
        postAmount: 0,
        postTransferAmount: 0,
        gameAllBetAmount: 0,
        gameVoucherDiffAmount: 0,
        gameAllDiffAmount: 0,
        withdrawalAmount: 0,
        systemStockAmount: 0
      }
    );

    // 计算平均值
    return {
      ...totals,
      avgInviteCost: totals.inviteUserCnt > 0 ? totals.avgInviteCost / totals.inviteUserCnt : 0
    };
  }, [data]);

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.costAnalysis" />}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.exchangeCoinUserCnt" />}
              value={metrics.exchangeCoinUserCnt}
              loading={loading}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.exchangeCoinAmount" />}
              value={metrics.exchangeCoinAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.inviteUserCnt" />}
              value={metrics.inviteUserCnt}
              loading={loading}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.avgInviteCost" />}
              value={metrics.avgInviteCost}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.rechargeAmount" />}
              value={metrics.rechargeAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.liveAmount" />}
              value={metrics.liveAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.liveTransferAmount" />}
              value={metrics.liveTransferAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.postAmount" />}
              value={metrics.postAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.postTransferAmount" />}
              value={metrics.postTransferAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.gameAllBetAmount" />}
              value={metrics.gameAllBetAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.gameVoucherDiffAmount" />}
              value={metrics.gameVoucherDiffAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.gameAllDiffAmount" />}
              value={metrics.gameAllDiffAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.withdrawalAmount" />}
              value={metrics.withdrawalAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.costAnalysisData.systemStockAmount" />}
              value={metrics.systemStockAmount}
              loading={loading}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
