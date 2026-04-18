// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { UserAmountDistributionRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface UserAmountDistributionTableProps {
  loading: boolean;
  data: UserAmountDistributionRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends UserAmountDistributionRecord {
  range_order_label: string;
  amount_range_label: string;
  user_cnt_label: string;
  silver_coin_label: string;
  pct_0_label: string;
  pct_0_10_label: string;
  pct_10_20_label: string;
  pct_20_30_label: string;
  pct_30_40_label: string;
  pct_40_50_label: string;
  pct_50_60_label: string;
  pct_60_70_label: string;
  pct_70_80_label: string;
  pct_80_90_label: string;
  pct_90_100_label: string;
}

export const UserAmountDistributionTable = memo(({ data, loading }: UserAmountDistributionTableProps) => {
  const intl = useIntl();

  const columns: ProColumns<FormattedRecord>[] = [
    {
      title: <FormattedMessage id="data.bonusCenter.rangeOrder" />,
      dataIndex: 'range_order_label',
      width: 80,
      fixed: 'left'
    },
    {
      title: <FormattedMessage id="data.bonusCenter.amountRange" />,
      dataIndex: 'amount_range_label',
      width: 200,
      fixed: 'left'
    },
    {
      title: <FormattedMessage id="data.bonusCenter.userCnt" />,
      dataIndex: 'user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.silverCoin" />,
      dataIndex: 'silver_coin_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct0" />,
      dataIndex: 'pct_0_label',
      width: 120
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct0_10" />,
      dataIndex: 'pct_0_10_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct10_20" />,
      dataIndex: 'pct_10_20_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct20_30" />,
      dataIndex: 'pct_20_30_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct30_40" />,
      dataIndex: 'pct_30_40_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct40_50" />,
      dataIndex: 'pct_40_50_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct50_60" />,
      dataIndex: 'pct_50_60_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct60_70" />,
      dataIndex: 'pct_60_70_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct70_80" />,
      dataIndex: 'pct_70_80_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct80_90" />,
      dataIndex: 'pct_80_90_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pct90_100" />,
      dataIndex: 'pct_90_100_label',
      width: 150
    }
  ];

  return (
    <ProTable
      {...(tableConfig as Record<string, unknown>)}
      headerTitle={<FormattedMessage id="data.bonusCenter.userAmountDistribution" />}
      columns={columns}
      dataSource={data}
      loading={loading}
      search={false}
      pagination={false}
      toolBarRender={() => [
        <GoshExportButton
          key="export"
          columns={columns}
          data={data}
          title={intl.formatMessage({
            id: 'data.bonusCenter.userAmountDistribution'
          })}
          intl={intl}
        />
      ]}
      options={{ reload: false }}
    />
  );
});
