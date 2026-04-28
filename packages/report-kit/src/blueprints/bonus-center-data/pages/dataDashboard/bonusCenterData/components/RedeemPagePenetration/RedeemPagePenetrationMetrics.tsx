// @ts-nocheck
import { RedeemPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface RedeemPagePenetrationMetricsProps {
  data: RedeemPagePenetrationRecord[];
  loading?: boolean;
}

export const RedeemPagePenetrationMetrics = memo(({ data, loading }: RedeemPagePenetrationMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalPageExposureUserCnt: 0,
        totalPromptModuleExposureUserCnt: 0,
        totalTabModuleExposureUserCnt: 0,
        totalItemListModuleExposureUserCnt: 0,
        totalClaimButtonClickUserCnt: 0,
        totalTabSwitchClickUserCnt: 0,
        totalItemButtonClickUserCnt: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        totalPageExposureUserCnt: acc.totalPageExposureUserCnt + (item.page_exposure_user_cnt || 0),
        totalPromptModuleExposureUserCnt:
          acc.totalPromptModuleExposureUserCnt + (item.prompt_module_exposure_user_cnt || 0),
        totalTabModuleExposureUserCnt: acc.totalTabModuleExposureUserCnt + (item.tab_module_exposure_user_cnt || 0),
        totalItemListModuleExposureUserCnt:
          acc.totalItemListModuleExposureUserCnt + (item.item_list_module_exposure_user_cnt || 0),
        totalClaimButtonClickUserCnt: acc.totalClaimButtonClickUserCnt + (item.claim_button_click_user_cnt || 0),
        totalTabSwitchClickUserCnt: acc.totalTabSwitchClickUserCnt + (item.tab_switch_click_user_cnt || 0),
        totalItemButtonClickUserCnt: acc.totalItemButtonClickUserCnt + (item.item_button_click_user_cnt || 0)
      }),
      {
        totalPageExposureUserCnt: 0,
        totalPromptModuleExposureUserCnt: 0,
        totalTabModuleExposureUserCnt: 0,
        totalItemListModuleExposureUserCnt: 0,
        totalClaimButtonClickUserCnt: 0,
        totalTabSwitchClickUserCnt: 0,
        totalItemButtonClickUserCnt: 0
      }
    );

    return totals;
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.redeemPagePenetrationMetrics" />} loading={loading} bordered>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pageExposureUserCnt" />}
              value={formatNumber(metrics.totalPageExposureUserCnt)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.promptModuleExposureUserCnt" />}
              value={formatNumber(metrics.totalPromptModuleExposureUserCnt)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.tabModuleExposureUserCnt" />}
              value={formatNumber(metrics.totalTabModuleExposureUserCnt)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.itemListModuleExposureUserCnt" />}
              value={formatNumber(metrics.totalItemListModuleExposureUserCnt)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.claimButtonClickUserCnt" />}
              value={formatNumber(metrics.totalClaimButtonClickUserCnt)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.tabSwitchClickUserCnt" />}
              value={formatNumber(metrics.totalTabSwitchClickUserCnt)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.itemButtonClickUserCnt" />}
              value={formatNumber(metrics.totalItemButtonClickUserCnt)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
