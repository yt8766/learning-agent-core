// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { PujaPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface PujaPagePenetrationTableProps {
  loading: boolean;
  data: PujaPagePenetrationRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends PujaPagePenetrationRecord {
  dt_label: string;
  app_label: string;
  user_type_label: string;
  // 免费供奉
  free_page_exposure_all_cnt_label: string;
  free_page_pray_click_all_cnt_label: string;
  free_page_close_click_all_cnt_label: string;
  free_reward_close_click_all_cnt_label: string;
  free_page_exposure_user_cnt_label: string;
  free_page_pray_click_user_cnt_label: string;
  free_page_close_click_user_cnt_label: string;
  free_reward_close_click_user_cnt_label: string;
  free_page_pray_click_user_percent_label: string;
  free_page_close_click_user_percent_label: string;
  free_reward_close_click_user_percent_label: string;
  // 银币供奉
  second_page_exposure_all_cnt_label: string;
  second_page_offer_click_all_cnt_label: string;
  second_page_close_click_all_cnt_label: string;
  second_page_exposure_user_cnt_label: string;
  second_page_offer_click_user_cnt_label: string;
  second_page_close_click_user_cnt_label: string;
  second_page_offer_click_user_percent_label: string;
  second_page_close_click_user_percent_label: string;
  // 象神指引
  guidance_page_exposure_all_cnt_label: string;
  guidance_page_share_click_all_cnt_label: string;
  guidance_page_close_click_all_cnt_label: string;
  guidance_page_exposure_user_cnt_label: string;
  guidance_page_share_click_user_cnt_label: string;
  guidance_page_close_click_user_cnt_label: string;
  guidance_page_share_click_user_percent_label: string;
  guidance_page_close_click_user_percent_label: string;
}

export const PujaPagePenetrationTable = memo(({ data, loading, searchParams }: PujaPagePenetrationTableProps) => {
  const intl = useIntl();

  const columns: ProColumns<FormattedRecord>[] = [
    {
      title: <FormattedMessage id="common.time.date" />,
      dataIndex: 'dt_label',
      width: 120,
      fixed: 'left'
    },
    {
      title: 'App',
      dataIndex: 'app_label',
      width: 100
    },
    {
      title: <FormattedMessage id="data.bonusCenter.userType" />,
      dataIndex: 'user_type_label',
      width: 100
    },
    // 免费供奉
    {
      title: <FormattedMessage id="data.bonusCenter.freePageExposureAllCnt" />,
      dataIndex: 'free_page_exposure_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freePagePrayClickAllCnt" />,
      dataIndex: 'free_page_pray_click_all_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freePageCloseClickAllCnt" />,
      dataIndex: 'free_page_close_click_all_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freeRewardCloseClickAllCnt" />,
      dataIndex: 'free_reward_close_click_all_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freePageExposureUserCnt" />,
      dataIndex: 'free_page_exposure_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freePagePrayClickUserCnt" />,
      dataIndex: 'free_page_pray_click_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freePageCloseClickUserCnt" />,
      dataIndex: 'free_page_close_click_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freeRewardCloseClickUserCnt" />,
      dataIndex: 'free_reward_close_click_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freePagePrayClickUserPercent" />,
      dataIndex: 'free_page_pray_click_user_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freePageCloseClickUserPercent" />,
      dataIndex: 'free_page_close_click_user_percent_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.freeRewardCloseClickUserPercent" />,
      dataIndex: 'free_reward_close_click_user_percent_label',
      width: 260
    },
    // 银币供奉
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageExposureAllCnt" />,
      dataIndex: 'second_page_exposure_all_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageOfferClickAllCnt" />,
      dataIndex: 'second_page_offer_click_all_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageCloseClickAllCnt" />,
      dataIndex: 'second_page_close_click_all_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageExposureUserCnt" />,
      dataIndex: 'second_page_exposure_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageOfferClickUserCnt" />,
      dataIndex: 'second_page_offer_click_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageCloseClickUserCnt" />,
      dataIndex: 'second_page_close_click_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageOfferClickUserPercent" />,
      dataIndex: 'second_page_offer_click_user_percent_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.secondPageCloseClickUserPercent" />,
      dataIndex: 'second_page_close_click_user_percent_label',
      width: 260
    },
    // 象神指引
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageExposureAllCnt" />,
      dataIndex: 'guidance_page_exposure_all_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageShareClickAllCnt" />,
      dataIndex: 'guidance_page_share_click_all_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageCloseClickAllCnt" />,
      dataIndex: 'guidance_page_close_click_all_cnt_label',
      width: 260
    },
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageExposureUserCnt" />,
      dataIndex: 'guidance_page_exposure_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageShareClickUserCnt" />,
      dataIndex: 'guidance_page_share_click_user_cnt_label',
      width: 260
    },
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageCloseClickUserCnt" />,
      dataIndex: 'guidance_page_close_click_user_cnt_label',
      width: 260
    },
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageShareClickUserPercent" />,
      dataIndex: 'guidance_page_share_click_user_percent_label',
      width: 280
    },
    {
      title: <FormattedMessage id="data.bonusCenter.guidancePageCloseClickUserPercent" />,
      dataIndex: 'guidance_page_close_click_user_percent_label',
      width: 300
    }
  ];

  return (
    <ProTable
      {...(tableConfig as Record<string, unknown>)}
      columns={columns}
      loading={loading}
      dataSource={data}
      search={false}
      options={false}
      cardBordered={false}
      bordered
      scroll={{ x: 'max-content' }}
      toolBarRender={() => [
        <GoshExportButton
          key="export"
          columns={columns}
          data={data}
          title={intl.formatMessage({
            id: 'data.bonusCenter.pujaPagePenetration'
          })}
          intl={intl}
          enableAudit={true}
          menuName="Bonus Center数据"
          getQueryParams={() => searchParams}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.pujaPagePenetration'
      })}
    />
  );
});
