// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { TaskPagePenetrationRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface TaskPagePenetrationTableProps {
  loading: boolean;
  data: TaskPagePenetrationRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends TaskPagePenetrationRecord {
  dt_label: string;
  app_label: string;
  user_type_label: string;
  login_dau_label: string;
  bc_both_user_cnt_label: string;
  bc_both_user_percent_label: string;
  page_exposure_user_cnt_label: string;
  module_exposure_user_cnt_label: string;
  button_click_user_cnt_label: string;
  invite_click_user_cnt_label: string;
  task_button_click_user_cnt_label: string;
  page_exposure_user_percent_label: string;
  module_exposure_user_percent_label: string;
  button_click_user_percent_label: string;
  task_button_click_user_percent_label: string;
  invite_click_user_percent_label: string;
}

export const TaskPagePenetrationTable = memo(({ data, loading, searchParams }: TaskPagePenetrationTableProps) => {
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
      title: <FormattedMessage id="data.bonusCenter.loginDau" />,
      dataIndex: 'login_dau_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.bcBothUserCnt" />,
      dataIndex: 'bc_both_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.bcBothUserPercent" />,
      dataIndex: 'bc_both_user_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pageExposureUserCnt" />,
      dataIndex: 'page_exposure_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.moduleExposureUserCnt" />,
      dataIndex: 'module_exposure_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.buttonClickUserCnt" />,
      dataIndex: 'button_click_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inviteClickUserCnt" />,
      dataIndex: 'invite_click_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.taskButtonClickUserCnt" />,
      dataIndex: 'task_button_click_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pageExposureUserPercent" />,
      dataIndex: 'page_exposure_user_percent_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.moduleExposureUserPercent" />,
      dataIndex: 'module_exposure_user_percent_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.buttonClickUserPercent" />,
      dataIndex: 'button_click_user_percent_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.taskButtonClickUserPercent" />,
      dataIndex: 'task_button_click_user_percent_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inviteClickUserPercent" />,
      dataIndex: 'invite_click_user_percent_label',
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
            id: 'data.bonusCenter.taskPagePenetration'
          })}
          intl={intl}
          enableAudit={true}
          menuName="Bonus Center数据"
          getQueryParams={() => searchParams}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.taskPagePenetration'
      })}
    />
  );
});
