// @ts-nocheck
import { PujaPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface PujaPagePenetrationMetricsProps {
  data: PujaPagePenetrationRecord[];
  loading?: boolean;
}

export const PujaPagePenetrationMetrics = memo(({ data, loading }: PujaPagePenetrationMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        // 免费供奉
        totalFreePageExposureUserCnt: 0,
        totalFreePagePrayClickUserCnt: 0,
        avgFreePagePrayClickUserPercent: 0,
        // 银币供奉
        totalSecondPageExposureUserCnt: 0,
        totalSecondPageOfferClickUserCnt: 0,
        avgSecondPageOfferClickUserPercent: 0,
        // 象神指引
        totalGuidancePageExposureUserCnt: 0,
        totalGuidancePageShareClickUserCnt: 0,
        avgGuidancePageShareClickUserPercent: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        // 免费供奉
        totalFreePageExposureUserCnt: acc.totalFreePageExposureUserCnt + (item.free_page_exposure_user_cnt || 0),
        totalFreePagePrayClickUserCnt: acc.totalFreePagePrayClickUserCnt + (item.free_page_pray_click_user_cnt || 0),
        totalFreePagePrayClickUserPercent:
          acc.totalFreePagePrayClickUserPercent + (item.free_page_pray_click_user_percent || 0),
        // 银币供奉
        totalSecondPageExposureUserCnt: acc.totalSecondPageExposureUserCnt + (item.second_page_exposure_user_cnt || 0),
        totalSecondPageOfferClickUserCnt:
          acc.totalSecondPageOfferClickUserCnt + (item.second_page_offer_click_user_cnt || 0),
        totalSecondPageOfferClickUserPercent:
          acc.totalSecondPageOfferClickUserPercent + (item.second_page_offer_click_user_percent || 0),
        // 象神指引
        totalGuidancePageExposureUserCnt:
          acc.totalGuidancePageExposureUserCnt + (item.guidance_page_exposure_user_cnt || 0),
        totalGuidancePageShareClickUserCnt:
          acc.totalGuidancePageShareClickUserCnt + (item.guidance_page_share_click_user_cnt || 0),
        totalGuidancePageShareClickUserPercent:
          acc.totalGuidancePageShareClickUserPercent + (item.guidance_page_share_click_user_percent || 0)
      }),
      {
        totalFreePageExposureUserCnt: 0,
        totalFreePagePrayClickUserCnt: 0,
        totalFreePagePrayClickUserPercent: 0,
        totalSecondPageExposureUserCnt: 0,
        totalSecondPageOfferClickUserCnt: 0,
        totalSecondPageOfferClickUserPercent: 0,
        totalGuidancePageExposureUserCnt: 0,
        totalGuidancePageShareClickUserCnt: 0,
        totalGuidancePageShareClickUserPercent: 0
      }
    );

    // 计算平均值
    const count = data.length;
    return {
      totalFreePageExposureUserCnt: totals.totalFreePageExposureUserCnt,
      totalFreePagePrayClickUserCnt: totals.totalFreePagePrayClickUserCnt,
      avgFreePagePrayClickUserPercent: count > 0 ? totals.totalFreePagePrayClickUserPercent / count : 0,
      totalSecondPageExposureUserCnt: totals.totalSecondPageExposureUserCnt,
      totalSecondPageOfferClickUserCnt: totals.totalSecondPageOfferClickUserCnt,
      avgSecondPageOfferClickUserPercent: count > 0 ? totals.totalSecondPageOfferClickUserPercent / count : 0,
      totalGuidancePageExposureUserCnt: totals.totalGuidancePageExposureUserCnt,
      totalGuidancePageShareClickUserCnt: totals.totalGuidancePageShareClickUserCnt,
      avgGuidancePageShareClickUserPercent: count > 0 ? totals.totalGuidancePageShareClickUserPercent / count : 0
    };
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.pujaPagePenetrationMetrics" />} loading={loading} bordered>
      <Row gutter={[16, 16]}>
        {/* 免费供奉 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.freePageExposureUserCnt" />}
              value={formatNumber(metrics.totalFreePageExposureUserCnt)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.freePagePrayClickUserCnt" />}
              value={formatNumber(metrics.totalFreePagePrayClickUserCnt)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.freePagePrayClickUserPercent" />}
              value={formatPercentage(metrics.avgFreePagePrayClickUserPercent)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        {/* 银币供奉 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.secondPageExposureUserCnt" />}
              value={formatNumber(metrics.totalSecondPageExposureUserCnt)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.secondPageOfferClickUserCnt" />}
              value={formatNumber(metrics.totalSecondPageOfferClickUserCnt)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.secondPageOfferClickUserPercent" />}
              value={formatPercentage(metrics.avgSecondPageOfferClickUserPercent)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        {/* 象神指引 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.guidancePageExposureUserCnt" />}
              value={formatNumber(metrics.totalGuidancePageExposureUserCnt)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.guidancePageShareClickUserCnt" />}
              value={formatNumber(metrics.totalGuidancePageShareClickUserCnt)}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.guidancePageShareClickUserPercent" />}
              value={formatPercentage(metrics.avgGuidancePageShareClickUserPercent)}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
