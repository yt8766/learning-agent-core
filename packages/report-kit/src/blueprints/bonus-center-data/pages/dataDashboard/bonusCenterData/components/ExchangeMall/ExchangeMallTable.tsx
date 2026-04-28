// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { ExchangeMallRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface ExchangeMallTableProps {
  loading: boolean;
  data: ExchangeMallRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends ExchangeMallRecord {
  dt_label: string;
  app_label: string;
  user_type_label: string;
  props_all_cnt_label: string;
  props_amount_label: string;
  props_user_cnt_label: string;
  coin_all_cnt_label: string;
  coin_amount_label: string;
  coin_asset_amount_label: string;
  coin_user_cnt_label: string;
  voucher_all_cnt_label: string;
  voucher_amount_label: string;
  voucher_user_cnt_label: string;
  vip_voucher_all_cnt_label: string;
  vip_voucher_amount_label: string;
  vip_voucher_user_cnt_label: string;
  puja_all_cnt_label: string;
  puja_amount_label: string;
  puja_user_cnt_label: string;
  system_retrieve_all_cnt_label: string;
  system_retrieve_amount_label: string;
  system_retrieve_user_cnt_label: string;
  post_total_all_cnt_label: string;
  post_total_amount_label: string;
  post_total_user_cnt_label: string;
  post_1_all_cnt_label: string;
  post_1_amount_label: string;
  post_1_user_cnt_label: string;
  post_2_all_cnt_label: string;
  post_2_amount_label: string;
  post_2_user_cnt_label: string;
  post_3_all_cnt_label: string;
  post_3_amount_label: string;
  post_3_user_cnt_label: string;
  post_4_all_cnt_label: string;
  post_4_amount_label: string;
  post_4_user_cnt_label: string;
}

export const ExchangeMallTable = memo(({ data, loading, searchParams }: ExchangeMallTableProps) => {
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
    {
      title: <FormattedMessage id="data.bonusCenter.propsAllCnt" />,
      dataIndex: 'props_all_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.propsAmount" />,
      dataIndex: 'props_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.propsUserCnt" />,
      dataIndex: 'props_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.coinAllCnt" />,
      dataIndex: 'coin_all_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.coinAmount" />,
      dataIndex: 'coin_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.coinAssetAmount" />,
      dataIndex: 'coin_asset_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.coinUserCnt" />,
      dataIndex: 'coin_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.voucherAllCnt" />,
      dataIndex: 'voucher_all_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.voucherAmount" />,
      dataIndex: 'voucher_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.voucherUserCnt" />,
      dataIndex: 'voucher_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.vipVoucherAllCnt" />,
      dataIndex: 'vip_voucher_all_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.vipVoucherAmount" />,
      dataIndex: 'vip_voucher_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.vipVoucherUserCnt" />,
      dataIndex: 'vip_voucher_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaAllCnt" />,
      dataIndex: 'puja_all_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaAmount" />,
      dataIndex: 'puja_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaUserCnt" />,
      dataIndex: 'puja_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.systemRetrieveAllCnt" />,
      dataIndex: 'system_retrieve_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.systemRetrieveAmount" />,
      dataIndex: 'system_retrieve_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.systemRetrieveUserCnt" />,
      dataIndex: 'system_retrieve_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.postTotalAllCnt" />,
      dataIndex: 'post_total_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.postTotalAmount" />,
      dataIndex: 'post_total_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.postTotalUserCnt" />,
      dataIndex: 'post_total_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post1AllCnt" />,
      dataIndex: 'post_1_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post1Amount" />,
      dataIndex: 'post_1_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post1UserCnt" />,
      dataIndex: 'post_1_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post2AllCnt" />,
      dataIndex: 'post_2_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post2Amount" />,
      dataIndex: 'post_2_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post2UserCnt" />,
      dataIndex: 'post_2_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post3AllCnt" />,
      dataIndex: 'post_3_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post3Amount" />,
      dataIndex: 'post_3_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post3UserCnt" />,
      dataIndex: 'post_3_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post4AllCnt" />,
      dataIndex: 'post_4_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post4Amount" />,
      dataIndex: 'post_4_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.post4UserCnt" />,
      dataIndex: 'post_4_user_cnt_label',
      width: 180
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
      toolBarRender={() => [
        <GoshExportButton
          key="export"
          columns={columns}
          data={data}
          title={intl.formatMessage({
            id: 'data.bonusCenter.exchangeMall'
          })}
          intl={intl}
          enableAudit={true}
          menuName="Bonus Center数据"
          getQueryParams={() => searchParams}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.exchangeMall'
      })}
    />
  );
});
