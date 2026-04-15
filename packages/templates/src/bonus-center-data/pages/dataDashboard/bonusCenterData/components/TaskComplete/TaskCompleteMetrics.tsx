// @ts-nocheck
import { TaskCompleteRecord } from '@/types/data/bonusCenter';
import { ProCard } from '@ant-design/pro-components';
import { FormattedMessage } from 'react-intl';
import { Card, Col, Row, Statistic } from 'antd';
import { memo, useMemo } from 'react';

export interface TaskCompleteMetricsProps {
  data: TaskCompleteRecord[];
  loading?: boolean;
}

export const TaskCompleteMetrics = memo(({ data, loading }: TaskCompleteMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        // 象神三个阶段
        totalPujaOneStageExposureUserCnt: 0,
        totalPujaOneStageCompleteUserCnt: 0,
        avgPujaOneStageCompletePercent: 0,
        totalPujaTwoStageExposureUserCnt: 0,
        totalPujaTwoStageCompleteUserCnt: 0,
        avgPujaTwoStageCompletePercent: 0,
        totalPujaThreeStageExposureUserCnt: 0,
        totalPujaThreeStageCompleteUserCnt: 0,
        avgPujaThreeStageCompletePercent: 0,
        // 其他任务
        totalShareLiveExposureUserCnt: 0,
        totalShareLiveCompleteUserCnt: 0,
        avgShareLiveCompletePercent: 0,
        totalSharePostExposureUserCnt: 0,
        totalSharePostCompleteUserCnt: 0,
        avgSharePostCompletePercent: 0,
        totalCommentPostsExposureUserCnt: 0,
        totalCommentPostsCompleteUserCnt: 0,
        avgCommentPostsCompletePercent: 0,
        totalViewGamePageExposureUserCnt: 0,
        totalViewGamePageCompleteUserCnt: 0,
        avgViewGamePageCompletePercent: 0,
        totalFollowUserExposureUserCnt: 0,
        totalFollowUserCompleteUserCnt: 0,
        avgFollowUserCompletePercent: 0
      };
    }

    // 计算累计指标
    const totals = data.reduce(
      (acc, item) => ({
        // 象神三个阶段
        totalPujaOneStageExposureUserCnt:
          acc.totalPujaOneStageExposureUserCnt + (item.puja_one_stage_exposure_user_cnt || 0),
        totalPujaOneStageCompleteUserCnt:
          acc.totalPujaOneStageCompleteUserCnt + (item.puja_one_stage_complete_user_cnt || 0),
        totalPujaOneStageCompletePercent:
          acc.totalPujaOneStageCompletePercent + (item.puja_one_stage_complete_percent || 0),
        totalPujaTwoStageExposureUserCnt:
          acc.totalPujaTwoStageExposureUserCnt + (item.puja_two_stage_exposure_user_cnt || 0),
        totalPujaTwoStageCompleteUserCnt:
          acc.totalPujaTwoStageCompleteUserCnt + (item.puja_two_stage_complete_user_cnt || 0),
        totalPujaTwoStageCompletePercent:
          acc.totalPujaTwoStageCompletePercent + (item.puja_two_stage_complete_percent || 0),
        totalPujaThreeStageExposureUserCnt:
          acc.totalPujaThreeStageExposureUserCnt + (item.puja_three_stage_exposure_user_cnt || 0),
        totalPujaThreeStageCompleteUserCnt:
          acc.totalPujaThreeStageCompleteUserCnt + (item.puja_three_stage_complete_user_cnt || 0),
        totalPujaThreeStageCompletePercent:
          acc.totalPujaThreeStageCompletePercent + (item.puja_three_stage_complete_percent || 0),
        // 其他任务
        totalShareLiveExposureUserCnt: acc.totalShareLiveExposureUserCnt + (item.share_live_exposure_user_cnt || 0),
        totalShareLiveCompleteUserCnt: acc.totalShareLiveCompleteUserCnt + (item.share_live_complete_user_cnt || 0),
        totalShareLiveCompletePercent: acc.totalShareLiveCompletePercent + (item.share_live_complete_percent || 0),
        totalSharePostExposureUserCnt: acc.totalSharePostExposureUserCnt + (item.share_post_exposure_user_cnt || 0),
        totalSharePostCompleteUserCnt: acc.totalSharePostCompleteUserCnt + (item.share_post_complete_user_cnt || 0),
        totalSharePostCompletePercent: acc.totalSharePostCompletePercent + (item.share_post_complete_percent || 0),
        totalCommentPostsExposureUserCnt:
          acc.totalCommentPostsExposureUserCnt + (item.comment_posts_exposure_user_cnt || 0),
        totalCommentPostsCompleteUserCnt:
          acc.totalCommentPostsCompleteUserCnt + (item.comment_posts_complete_user_cnt || 0),
        totalCommentPostsCompletePercent:
          acc.totalCommentPostsCompletePercent + (item.comment_posts_complete_percent || 0),
        totalViewGamePageExposureUserCnt:
          acc.totalViewGamePageExposureUserCnt + (item.view_game_page_exposure_user_cnt || 0),
        totalViewGamePageCompleteUserCnt:
          acc.totalViewGamePageCompleteUserCnt + (item.view_game_page_complete_user_cnt || 0),
        totalViewGamePageCompletePercent:
          acc.totalViewGamePageCompletePercent + (item.view_game_page_complete_percent || 0),
        totalFollowUserExposureUserCnt: acc.totalFollowUserExposureUserCnt + (item.follow_user_exposure_user_cnt || 0),
        totalFollowUserCompleteUserCnt: acc.totalFollowUserCompleteUserCnt + (item.follow_user_complete_user_cnt || 0),
        totalFollowUserCompletePercent: acc.totalFollowUserCompletePercent + (item.follow_user_complete_percent || 0)
      }),
      {
        totalPujaOneStageExposureUserCnt: 0,
        totalPujaOneStageCompleteUserCnt: 0,
        totalPujaOneStageCompletePercent: 0,
        totalPujaTwoStageExposureUserCnt: 0,
        totalPujaTwoStageCompleteUserCnt: 0,
        totalPujaTwoStageCompletePercent: 0,
        totalPujaThreeStageExposureUserCnt: 0,
        totalPujaThreeStageCompleteUserCnt: 0,
        totalPujaThreeStageCompletePercent: 0,
        totalShareLiveExposureUserCnt: 0,
        totalShareLiveCompleteUserCnt: 0,
        totalShareLiveCompletePercent: 0,
        totalSharePostExposureUserCnt: 0,
        totalSharePostCompleteUserCnt: 0,
        totalSharePostCompletePercent: 0,
        totalCommentPostsExposureUserCnt: 0,
        totalCommentPostsCompleteUserCnt: 0,
        totalCommentPostsCompletePercent: 0,
        totalViewGamePageExposureUserCnt: 0,
        totalViewGamePageCompleteUserCnt: 0,
        totalViewGamePageCompletePercent: 0,
        totalFollowUserExposureUserCnt: 0,
        totalFollowUserCompleteUserCnt: 0,
        totalFollowUserCompletePercent: 0
      }
    );

    // 计算平均值
    const count = data.length;
    return {
      totalPujaOneStageExposureUserCnt: totals.totalPujaOneStageExposureUserCnt,
      totalPujaOneStageCompleteUserCnt: totals.totalPujaOneStageCompleteUserCnt,
      avgPujaOneStageCompletePercent: count > 0 ? totals.totalPujaOneStageCompletePercent / count : 0,
      totalPujaTwoStageExposureUserCnt: totals.totalPujaTwoStageExposureUserCnt,
      totalPujaTwoStageCompleteUserCnt: totals.totalPujaTwoStageCompleteUserCnt,
      avgPujaTwoStageCompletePercent: count > 0 ? totals.totalPujaTwoStageCompletePercent / count : 0,
      totalPujaThreeStageExposureUserCnt: totals.totalPujaThreeStageExposureUserCnt,
      totalPujaThreeStageCompleteUserCnt: totals.totalPujaThreeStageCompleteUserCnt,
      avgPujaThreeStageCompletePercent: count > 0 ? totals.totalPujaThreeStageCompletePercent / count : 0,
      totalShareLiveExposureUserCnt: totals.totalShareLiveExposureUserCnt,
      totalShareLiveCompleteUserCnt: totals.totalShareLiveCompleteUserCnt,
      avgShareLiveCompletePercent: count > 0 ? totals.totalShareLiveCompletePercent / count : 0,
      totalSharePostExposureUserCnt: totals.totalSharePostExposureUserCnt,
      totalSharePostCompleteUserCnt: totals.totalSharePostCompleteUserCnt,
      avgSharePostCompletePercent: count > 0 ? totals.totalSharePostCompletePercent / count : 0,
      totalCommentPostsExposureUserCnt: totals.totalCommentPostsExposureUserCnt,
      totalCommentPostsCompleteUserCnt: totals.totalCommentPostsCompleteUserCnt,
      avgCommentPostsCompletePercent: count > 0 ? totals.totalCommentPostsCompletePercent / count : 0,
      totalViewGamePageExposureUserCnt: totals.totalViewGamePageExposureUserCnt,
      totalViewGamePageCompleteUserCnt: totals.totalViewGamePageCompleteUserCnt,
      avgViewGamePageCompletePercent: count > 0 ? totals.totalViewGamePageCompletePercent / count : 0,
      totalFollowUserExposureUserCnt: totals.totalFollowUserExposureUserCnt,
      totalFollowUserCompleteUserCnt: totals.totalFollowUserCompleteUserCnt,
      avgFollowUserCompletePercent: count > 0 ? totals.totalFollowUserCompletePercent / count : 0
    };
  }, [data]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  return (
    <ProCard title={<FormattedMessage id="data.bonusCenter.taskCompleteMetrics" />} loading={loading} bordered>
      <Row gutter={[16, 16]}>
        {/* 象神第一阶段 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaOneStageExposureUserCnt" />}
              value={formatNumber(metrics.totalPujaOneStageExposureUserCnt)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaOneStageCompleteUserCnt" />}
              value={formatNumber(metrics.totalPujaOneStageCompleteUserCnt)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaOneStageCompletePercent" />}
              value={formatPercentage(metrics.avgPujaOneStageCompletePercent)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        {/* 象神第二阶段 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaTwoStageExposureUserCnt" />}
              value={formatNumber(metrics.totalPujaTwoStageExposureUserCnt)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaTwoStageCompleteUserCnt" />}
              value={formatNumber(metrics.totalPujaTwoStageCompleteUserCnt)}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaTwoStageCompletePercent" />}
              value={formatPercentage(metrics.avgPujaTwoStageCompletePercent)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        {/* 象神第三阶段 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaThreeStageExposureUserCnt" />}
              value={formatNumber(metrics.totalPujaThreeStageExposureUserCnt)}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaThreeStageCompleteUserCnt" />}
              value={formatNumber(metrics.totalPujaThreeStageCompleteUserCnt)}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.pujaThreeStageCompletePercent" />}
              value={formatPercentage(metrics.avgPujaThreeStageCompletePercent)}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        {/* Share Live */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.shareLiveExposureUserCnt" />}
              value={formatNumber(metrics.totalShareLiveExposureUserCnt)}
              valueStyle={{ color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.shareLiveCompleteUserCnt" />}
              value={formatNumber(metrics.totalShareLiveCompleteUserCnt)}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.shareLiveCompletePercent" />}
              value={formatPercentage(metrics.avgShareLiveCompletePercent)}
              valueStyle={{ color: '#531dab' }}
            />
          </Card>
        </Col>
        {/* Share Post */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.sharePostExposureUserCnt" />}
              value={formatNumber(metrics.totalSharePostExposureUserCnt)}
              valueStyle={{ color: '#d46b08' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.sharePostCompleteUserCnt" />}
              value={formatNumber(metrics.totalSharePostCompleteUserCnt)}
              valueStyle={{ color: '#c41d7f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.sharePostCompletePercent" />}
              value={formatPercentage(metrics.avgSharePostCompletePercent)}
              valueStyle={{ color: '#08979c' }}
            />
          </Card>
        </Col>
        {/* Comment Posts */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.commentPostsExposureUserCnt" />}
              value={formatNumber(metrics.totalCommentPostsExposureUserCnt)}
              valueStyle={{ color: '#0958d9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.commentPostsCompleteUserCnt" />}
              value={formatNumber(metrics.totalCommentPostsCompleteUserCnt)}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.commentPostsCompletePercent" />}
              value={formatPercentage(metrics.avgCommentPostsCompletePercent)}
              valueStyle={{ color: '#d48806' }}
            />
          </Card>
        </Col>
        {/* View Game Page */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.viewGamePageExposureUserCnt" />}
              value={formatNumber(metrics.totalViewGamePageExposureUserCnt)}
              valueStyle={{ color: '#40a9ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.viewGamePageCompleteUserCnt" />}
              value={formatNumber(metrics.totalViewGamePageCompleteUserCnt)}
              valueStyle={{ color: '#73d13d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.viewGamePageCompletePercent" />}
              value={formatPercentage(metrics.avgViewGamePageCompletePercent)}
              valueStyle={{ color: '#b37feb' }}
            />
          </Card>
        </Col>
        {/* Follow User */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.followUserExposureUserCnt" />}
              value={formatNumber(metrics.totalFollowUserExposureUserCnt)}
              valueStyle={{ color: '#ffa940' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.followUserCompleteUserCnt" />}
              value={formatNumber(metrics.totalFollowUserCompleteUserCnt)}
              valueStyle={{ color: '#f759ab' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic
              title={<FormattedMessage id="data.bonusCenter.followUserCompletePercent" />}
              value={formatPercentage(metrics.avgFollowUserCompletePercent)}
              valueStyle={{ color: '#36cfc9' }}
            />
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
});
