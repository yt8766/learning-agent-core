// @ts-nocheck
import { GoshExportButton } from '@/components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { TaskCompleteRecord } from '@/types/data/bonusCenter';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { memo } from 'react';
import type { SearchParams } from '../../config';

export interface TaskCompleteTableProps {
  loading: boolean;
  data: TaskCompleteRecord[];
  searchParams: SearchParams;
}

interface FormattedRecord extends TaskCompleteRecord {
  dt_label: string;
  app_label: string;
  user_type_label: string;
  puja_one_stage_exposure_user_cnt_label: string;
  puja_one_stage_complete_user_cnt_label: string;
  puja_one_stage_complete_percent_label: string;
  puja_two_stage_exposure_user_cnt_label: string;
  puja_two_stage_complete_user_cnt_label: string;
  puja_two_stage_complete_percent_label: string;
  puja_three_stage_exposure_user_cnt_label: string;
  puja_three_stage_complete_user_cnt_label: string;
  puja_three_stage_complete_percent_label: string;
  share_live_exposure_user_cnt_label: string;
  share_live_complete_user_cnt_label: string;
  share_live_complete_percent_label: string;
  share_post_exposure_user_cnt_label: string;
  share_post_complete_user_cnt_label: string;
  share_post_complete_percent_label: string;
  comment_posts_exposure_user_cnt_label: string;
  comment_posts_complete_user_cnt_label: string;
  comment_posts_complete_percent_label: string;
  view_game_page_exposure_user_cnt_label: string;
  view_game_page_complete_user_cnt_label: string;
  view_game_page_complete_percent_label: string;
  follow_user_exposure_user_cnt_label: string;
  follow_user_complete_user_cnt_label: string;
  follow_user_complete_percent_label: string;
}

export const TaskCompleteTable = memo(({ data, loading, searchParams }: TaskCompleteTableProps) => {
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
      title: <FormattedMessage id="data.bonusCenter.pujaOneStageExposureUserCnt" />,
      dataIndex: 'puja_one_stage_exposure_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaOneStageCompleteUserCnt" />,
      dataIndex: 'puja_one_stage_complete_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaOneStageCompletePercent" />,
      dataIndex: 'puja_one_stage_complete_percent_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaTwoStageExposureUserCnt" />,
      dataIndex: 'puja_two_stage_exposure_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaTwoStageCompleteUserCnt" />,
      dataIndex: 'puja_two_stage_complete_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaTwoStageCompletePercent" />,
      dataIndex: 'puja_two_stage_complete_percent_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaThreeStageExposureUserCnt" />,
      dataIndex: 'puja_three_stage_exposure_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaThreeStageCompleteUserCnt" />,
      dataIndex: 'puja_three_stage_complete_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.pujaThreeStageCompletePercent" />,
      dataIndex: 'puja_three_stage_complete_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.shareLiveExposureUserCnt" />,
      dataIndex: 'share_live_exposure_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.shareLiveCompleteUserCnt" />,
      dataIndex: 'share_live_complete_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.shareLiveCompletePercent" />,
      dataIndex: 'share_live_complete_percent_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.sharePostExposureUserCnt" />,
      dataIndex: 'share_post_exposure_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.sharePostCompleteUserCnt" />,
      dataIndex: 'share_post_complete_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.sharePostCompletePercent" />,
      dataIndex: 'share_post_complete_percent_label',
      width: 180
    },
    {
      title: <FormattedMessage id="data.bonusCenter.commentPostsExposureUserCnt" />,
      dataIndex: 'comment_posts_exposure_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.commentPostsCompleteUserCnt" />,
      dataIndex: 'comment_posts_complete_user_cnt_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.commentPostsCompletePercent" />,
      dataIndex: 'comment_posts_complete_percent_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.viewGamePageExposureUserCnt" />,
      dataIndex: 'view_game_page_exposure_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.viewGamePageCompleteUserCnt" />,
      dataIndex: 'view_game_page_complete_user_cnt_label',
      width: 240
    },
    {
      title: <FormattedMessage id="data.bonusCenter.viewGamePageCompletePercent" />,
      dataIndex: 'view_game_page_complete_percent_label',
      width: 220
    },
    {
      title: <FormattedMessage id="data.bonusCenter.followUserExposureUserCnt" />,
      dataIndex: 'follow_user_exposure_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.followUserCompleteUserCnt" />,
      dataIndex: 'follow_user_complete_user_cnt_label',
      width: 200
    },
    {
      title: <FormattedMessage id="data.bonusCenter.followUserCompletePercent" />,
      dataIndex: 'follow_user_complete_percent_label',
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
      scroll={{ x: 'max-content' }}
      toolBarRender={() => [
        <GoshExportButton
          key="export"
          columns={columns}
          data={data}
          title={intl.formatMessage({
            id: 'data.bonusCenter.taskComplete'
          })}
          intl={intl}
          enableAudit={true}
          menuName="Bonus Center数据"
          getQueryParams={() => searchParams}
        />
      ]}
      headerTitle={intl.formatMessage({
        id: 'data.bonusCenter.taskComplete'
      })}
    />
  );
});
