// @ts-nocheck
import { ExchangeMallRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface ExchangeMallMetricsProps {
  data: ExchangeMallRecord[];
  loading?: boolean;
}

export const ExchangeMallMetrics = memo(({ data, loading }: ExchangeMallMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        propsAllCnt: 0,
        propsAmount: 0,
        propsUserCnt: 0,
        coinAllCnt: 0,
        coinAmount: 0,
        coinAssetAmount: 0,
        coinUserCnt: 0,
        voucherAllCnt: 0,
        voucherAmount: 0,
        voucherUserCnt: 0,
        vipVoucherAllCnt: 0,
        vipVoucherAmount: 0,
        vipVoucherUserCnt: 0,
        pujaAllCnt: 0,
        pujaAmount: 0,
        pujaUserCnt: 0,
        systemRetrieveAllCnt: 0,
        systemRetrieveAmount: 0,
        systemRetrieveUserCnt: 0,
        postTotalAllCnt: 0,
        postTotalAmount: 0,
        postTotalUserCnt: 0,
        post1AllCnt: 0,
        post1Amount: 0,
        post1UserCnt: 0,
        post2AllCnt: 0,
        post2Amount: 0,
        post2UserCnt: 0,
        post3AllCnt: 0,
        post3Amount: 0,
        post3UserCnt: 0,
        post4AllCnt: 0,
        post4Amount: 0,
        post4UserCnt: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        propsAllCnt: acc.propsAllCnt + (item.props_all_cnt || 0),
        propsAmount: acc.propsAmount + (item.props_amount || 0),
        propsUserCnt: acc.propsUserCnt + (item.props_user_cnt || 0),
        coinAllCnt: acc.coinAllCnt + (item.coin_all_cnt || 0),
        coinAmount: acc.coinAmount + (item.coin_amount || 0),
        coinAssetAmount: acc.coinAssetAmount + (item.coin_asset_amount || 0),
        coinUserCnt: acc.coinUserCnt + (item.coin_user_cnt || 0),
        voucherAllCnt: acc.voucherAllCnt + (item.voucher_all_cnt || 0),
        voucherAmount: acc.voucherAmount + (item.voucher_amount || 0),
        voucherUserCnt: acc.voucherUserCnt + (item.voucher_user_cnt || 0),
        vipVoucherAllCnt: acc.vipVoucherAllCnt + (item.vip_voucher_all_cnt || 0),
        vipVoucherAmount: acc.vipVoucherAmount + (item.vip_voucher_amount || 0),
        vipVoucherUserCnt: acc.vipVoucherUserCnt + (item.vip_voucher_user_cnt || 0),
        pujaAllCnt: acc.pujaAllCnt + (item.puja_all_cnt || 0),
        pujaAmount: acc.pujaAmount + (item.puja_amount || 0),
        pujaUserCnt: acc.pujaUserCnt + (item.puja_user_cnt || 0),
        systemRetrieveAllCnt: acc.systemRetrieveAllCnt + (item.system_retrieve_all_cnt || 0),
        systemRetrieveAmount: acc.systemRetrieveAmount + (item.system_retrieve_amount || 0),
        systemRetrieveUserCnt: acc.systemRetrieveUserCnt + (item.system_retrieve_user_cnt || 0),
        postTotalAllCnt: acc.postTotalAllCnt + (item.post_total_all_cnt || 0),
        postTotalAmount: acc.postTotalAmount + (item.post_total_amount || 0),
        postTotalUserCnt: acc.postTotalUserCnt + (item.post_total_user_cnt || 0),
        post1AllCnt: acc.post1AllCnt + (item.post_1_all_cnt || 0),
        post1Amount: acc.post1Amount + (item.post_1_amount || 0),
        post1UserCnt: acc.post1UserCnt + (item.post_1_user_cnt || 0),
        post2AllCnt: acc.post2AllCnt + (item.post_2_all_cnt || 0),
        post2Amount: acc.post2Amount + (item.post_2_amount || 0),
        post2UserCnt: acc.post2UserCnt + (item.post_2_user_cnt || 0),
        post3AllCnt: acc.post3AllCnt + (item.post_3_all_cnt || 0),
        post3Amount: acc.post3Amount + (item.post_3_amount || 0),
        post3UserCnt: acc.post3UserCnt + (item.post_3_user_cnt || 0),
        post4AllCnt: acc.post4AllCnt + (item.post_4_all_cnt || 0),
        post4Amount: acc.post4Amount + (item.post_4_amount || 0),
        post4UserCnt: acc.post4UserCnt + (item.post_4_user_cnt || 0)
      }),
      {
        propsAllCnt: 0,
        propsAmount: 0,
        propsUserCnt: 0,
        coinAllCnt: 0,
        coinAmount: 0,
        coinAssetAmount: 0,
        coinUserCnt: 0,
        voucherAllCnt: 0,
        voucherAmount: 0,
        voucherUserCnt: 0,
        vipVoucherAllCnt: 0,
        vipVoucherAmount: 0,
        vipVoucherUserCnt: 0,
        pujaAllCnt: 0,
        pujaAmount: 0,
        pujaUserCnt: 0,
        systemRetrieveAllCnt: 0,
        systemRetrieveAmount: 0,
        systemRetrieveUserCnt: 0,
        postTotalAllCnt: 0,
        postTotalAmount: 0,
        postTotalUserCnt: 0,
        post1AllCnt: 0,
        post1Amount: 0,
        post1UserCnt: 0,
        post2AllCnt: 0,
        post2Amount: 0,
        post2UserCnt: 0,
        post3AllCnt: 0,
        post3Amount: 0,
        post3UserCnt: 0,
        post4AllCnt: 0,
        post4Amount: 0,
        post4UserCnt: 0
      }
    );

    return totals;
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatAmount = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.exchangeMallMetrics" />} loading={loading} bordered>
      <Row gutter={[16, 16]}>
        {/* 道具 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.propsAllCnt" />}
              value={formatNumber(metrics.propsAllCnt)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.propsAmount" />}
              value={formatAmount(metrics.propsAmount)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.propsUserCnt" />}
              value={formatNumber(metrics.propsUserCnt)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        {/* 金币 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.coinAllCnt" />}
              value={formatNumber(metrics.coinAllCnt)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.coinAmount" />}
              value={formatAmount(metrics.coinAmount)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.coinAssetAmount" />}
              value={formatAmount(metrics.coinAssetAmount)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.coinUserCnt" />}
              value={formatNumber(metrics.coinUserCnt)}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        {/* 游戏券 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.voucherAllCnt" />}
              value={formatNumber(metrics.voucherAllCnt)}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.voucherAmount" />}
              value={formatAmount(metrics.voucherAmount)}
              valueStyle={{ color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.voucherUserCnt" />}
              value={formatNumber(metrics.voucherUserCnt)}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        {/* 试看券 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.vipVoucherAllCnt" />}
              value={formatNumber(metrics.vipVoucherAllCnt)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.vipVoucherAmount" />}
              value={formatAmount(metrics.vipVoucherAmount)}
              valueStyle={{ color: '#ad2102' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.vipVoucherUserCnt" />}
              value={formatNumber(metrics.vipVoucherUserCnt)}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        {/* 付费post总 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.postTotalAllCnt" />}
              value={formatNumber(metrics.postTotalAllCnt)}
              valueStyle={{ color: '#531dab' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.postTotalAmount" />}
              value={formatAmount(metrics.postTotalAmount)}
              valueStyle={{ color: '#d46b08' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.postTotalUserCnt" />}
              value={formatNumber(metrics.postTotalUserCnt)}
              valueStyle={{ color: '#c41d7f' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
