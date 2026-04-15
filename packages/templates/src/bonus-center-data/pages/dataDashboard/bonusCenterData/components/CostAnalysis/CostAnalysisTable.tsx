// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { CostAnalysisRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';

export interface CostAnalysisTableProps {
  loading: boolean;
  data: CostAnalysisRecord[];
}

interface FormattedRecord extends CostAnalysisRecord {
  dt_label: string;
  exchange_coin_user_cnt_label: string;
  exchange_coin_amount_label: string;
  invite_user_cnt_label: string;
  avg_invite_cost_label: string;
  recharge_amount_label: string;
  live_amount_label: string;
  live_transfer_amount_label: string;
  post_amount_label: string;
  post_transfer_amount_label: string;
  game_all_bet_amount_label: string;
  game_voucher_diff_amount_label: string;
  game_all_diff_amount_label: string;
  withdrawal_amount_label: string;
  system_stock_amount_label: string;
}

export const CostAnalysisTable = memo(({ data, loading }: CostAnalysisTableProps) => {
  const intl = useIntl();

  const columns: ProColumns<FormattedRecord>[] = [
    {
      title: <FormattedMessage id="common.time.date" />,
      dataIndex: 'dt_label',
      width: 120,
      fixed: 'left'
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.exchangeCoinUserCnt" />,
      dataIndex: 'exchange_coin_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.exchangeCoinAmount" />,
      dataIndex: 'exchange_coin_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.inviteUserCnt" />,
      dataIndex: 'invite_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.avgInviteCost" />,
      dataIndex: 'avg_invite_cost_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.rechargeAmount" />,
      dataIndex: 'recharge_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.liveAmount" />,
      dataIndex: 'live_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.liveTransferAmount" />,
      dataIndex: 'live_transfer_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.postAmount" />,
      dataIndex: 'post_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.postTransferAmount" />,
      dataIndex: 'post_transfer_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.gameAllBetAmount" />,
      dataIndex: 'game_all_bet_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.gameVoucherDiffAmount" />,
      dataIndex: 'game_voucher_diff_amount_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.gameAllDiffAmount" />,
      dataIndex: 'game_all_diff_amount_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.withdrawalAmount" />,
      dataIndex: 'withdrawal_amount_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.costAnalysisData.systemStockAmount" />,
      dataIndex: 'system_stock_amount_label',
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
            id: 'data.bonusCenter.costAnalysis'
          })}
          intl={intl}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.costAnalysis'
      })}
    />
  );
});
