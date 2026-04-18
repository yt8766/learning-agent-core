// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { UserRemainRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface UserRemainTableProps {
  loading: boolean;
  data: UserRemainRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends UserRemainRecord {
  dt_label: string;
  app_label: string;
  user_type_label: string;
  all_user_cnt_label: string;
  all_user_remain_1d_percent_label: string;
  all_user_remain_3d_percent_label: string;
  all_user_remain_7d_percent_label: string;
  no_bc_user_cnt_label: string;
  no_bc_user_remain_1d_percent_label: string;
  no_bc_user_remain_3d_percent_label: string;
  no_bc_user_remain_7d_percent_label: string;
  in_bc_user_cnt_label: string;
  in_bc_user_remain_1d_percent_label: string;
  in_bc_user_remain_3d_percent_label: string;
  in_bc_user_remain_7d_percent_label: string;
  in_bc_user_module_remain_1d_percent_label: string;
  in_bc_user_module_remain_3d_percent_label: string;
  in_bc_user_module_remain_7d_percent_label: string;
}

export const UserRemainTable = memo(({ data, loading, searchParams }: UserRemainTableProps) => {
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
      title: <FormattedMessage id="data.bonusCenter.allUserCnt" />,
      dataIndex: 'all_user_cnt_label',
      width: 150
    },
    {
      title: <FormattedMessage id="data.bonusCenter.allUserRemain1dPercent" />,
      dataIndex: 'all_user_remain_1d_percent_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.allUserRemain3dPercent" />,
      dataIndex: 'all_user_remain_3d_percent_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.allUserRemain7dPercent" />,
      dataIndex: 'all_user_remain_7d_percent_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.noBcUserCnt" />,
      dataIndex: 'no_bc_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.noBcUserRemain1dPercent" />,
      dataIndex: 'no_bc_user_remain_1d_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.noBcUserRemain3dPercent" />,
      dataIndex: 'no_bc_user_remain_3d_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.noBcUserRemain7dPercent" />,
      dataIndex: 'no_bc_user_remain_7d_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inBcUserCnt" />,
      dataIndex: 'in_bc_user_cnt_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inBcUserRemain1dPercent" />,
      dataIndex: 'in_bc_user_remain_1d_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inBcUserRemain3dPercent" />,
      dataIndex: 'in_bc_user_remain_3d_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inBcUserRemain7dPercent" />,
      dataIndex: 'in_bc_user_remain_7d_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inBcUserModuleRemain1dPercent" />,
      dataIndex: 'in_bc_user_module_remain_1d_percent_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inBcUserModuleRemain3dPercent" />,
      dataIndex: 'in_bc_user_module_remain_3d_percent_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.inBcUserModuleRemain7dPercent" />,
      dataIndex: 'in_bc_user_module_remain_7d_percent_label',
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
            id: 'data.bonusCenter.userRemain'
          })}
          intl={intl}
          enableAudit={true}
          menuName="Bonus Center数据"
          getQueryParams={() => searchParams}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.userRemain'
      })}
    />
  );
});
