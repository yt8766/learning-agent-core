// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { AmountRecordRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface AmountRecordTableProps {
  loading: boolean;
  data: AmountRecordRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends AmountRecordRecord {
  dt_label: string;
  app_label: string;
  user_type_label: string;
  total_record_all_cnt_label: string;
  total_record_amount_label: string;
  total_record_user_cnt_label: string;
  total_record_amount_avg_label: string;
  invite_record_all_cnt_label: string;
  invite_record_amount_label: string;
  invite_record_user_cnt_label: string;
  invite_record_amount_avg_label: string;
  not_invite_record_all_cnt_label: string;
  not_invite_record_amount_label: string;
  not_invite_record_user_cnt_label: string;
  not_invite_record_amount_avg_label: string;
}

export const AmountRecordTable = memo(({ data, loading, searchParams }: AmountRecordTableProps) => {
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
      title: <FormattedMessage id="data.bonusCenter.totalRecordAllCnt" />,
      dataIndex: 'total_record_all_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.totalRecordAmount" />,
      dataIndex: 'total_record_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.totalRecordUserCnt" />,
      dataIndex: 'total_record_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.totalRecordAmountAvg" />,
      dataIndex: 'total_record_amount_avg_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inviteRecordAllCnt" />,
      dataIndex: 'invite_record_all_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inviteRecordAmount" />,
      dataIndex: 'invite_record_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inviteRecordUserCnt" />,
      dataIndex: 'invite_record_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inviteRecordAmountAvg" />,
      dataIndex: 'invite_record_amount_avg_label',
      width: 250
    },
    {
      title: <FormattedMessage id="data.bonusCenter.notInviteRecordAllCnt" />,
      dataIndex: 'not_invite_record_all_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.notInviteRecordAmount" />,
      dataIndex: 'not_invite_record_amount_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.notInviteRecordUserCnt" />,
      dataIndex: 'not_invite_record_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.notInviteRecordAmountAvg" />,
      dataIndex: 'not_invite_record_amount_avg_label',
      width: 240
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
            id: 'data.bonusCenter.amountRecord'
          })}
          intl={intl}
          enableAudit={true}
          menuName="Bonus Center数据"
          getQueryParams={() => searchParams}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.amountRecord'
      })}
    />
  );
});
