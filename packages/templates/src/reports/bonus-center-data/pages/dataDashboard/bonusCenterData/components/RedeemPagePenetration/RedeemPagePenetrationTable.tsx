// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { RedeemPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface RedeemPagePenetrationTableProps {
  loading: boolean;
  data: RedeemPagePenetrationRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends RedeemPagePenetrationRecord {
  dt_label: string;
  app_label: string;
  user_type_label: string;
  page_exposure_user_cnt_label: string;
  prompt_module_exposure_user_cnt_label: string;
  tab_module_exposure_user_cnt_label: string;
  item_list_module_exposure_user_cnt_label: string;
  claim_button_click_user_cnt_label: string;
  tab_switch_click_user_cnt_label: string;
  item_button_click_user_cnt_label: string;
}

export const RedeemPagePenetrationTable = memo(({ data, loading, searchParams }: RedeemPagePenetrationTableProps) => {
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
      title: <FormattedMessage id="data.bonusCenter.pageExposureUserCnt" />,
      dataIndex: 'page_exposure_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.promptModuleExposureUserCnt" />,
      dataIndex: 'prompt_module_exposure_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.tabModuleExposureUserCnt" />,
      dataIndex: 'tab_module_exposure_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.itemListModuleExposureUserCnt" />,
      dataIndex: 'item_list_module_exposure_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.claimButtonClickUserCnt" />,
      dataIndex: 'claim_button_click_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.tabSwitchClickUserCnt" />,
      dataIndex: 'tab_switch_click_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.itemButtonClickUserCnt" />,
      dataIndex: 'item_button_click_user_cnt_label',
      width: 200
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
            id: 'data.bonusCenter.redeemPagePenetration'
          })}
          intl={intl}
          enableAudit={true}
          menuName="Bonus Center数据"
          getQueryParams={() => searchParams}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.redeemPagePenetration'
      })}
    />
  );
});
