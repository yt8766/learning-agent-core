// @ts-nocheck
import { FormattedMessage } from 'react-intl';

export const enum bonusCenterTabType {
  taskPagePenetration = 1, // 任务页面渗透
  redeemPagePenetration = 2, // 兑换页面渗透
  pujaPagePenetration = 3, // 象神祈福渗透
  taskComplete = 4, // 任务完成记录
  userRemain = 5, // 新老用户留存
  amountRecord = 6, // 银币发放记录
  exchangeMall = 7, // 银币兑换记录
  userAmountDistribution = 8, // 用户银币分布
  costAnalysis = 9 // 成本分析数据
}

export const enum bonusCenterUserType {
  all = 'dau',
  new = 'new',
  old = 'old'
}

export const tabList = [
  {
    key: bonusCenterTabType.taskPagePenetration,
    tab: <FormattedMessage id="data.bonusCenter.taskPagePenetration" />
  },
  {
    key: bonusCenterTabType.redeemPagePenetration,
    tab: <FormattedMessage id="data.bonusCenter.redeemPagePenetration" />
  },
  {
    key: bonusCenterTabType.pujaPagePenetration,
    tab: <FormattedMessage id="data.bonusCenter.pujaPagePenetration" />
  },
  {
    key: bonusCenterTabType.taskComplete,
    tab: <FormattedMessage id="data.bonusCenter.taskComplete" />
  },
  {
    key: bonusCenterTabType.userRemain,
    tab: <FormattedMessage id="data.bonusCenter.userRemain" />
  },
  {
    key: bonusCenterTabType.amountRecord,
    tab: <FormattedMessage id="data.bonusCenter.amountRecord" />
  },
  {
    key: bonusCenterTabType.exchangeMall,
    tab: <FormattedMessage id="data.bonusCenter.exchangeMall" />
  },
  {
    key: bonusCenterTabType.userAmountDistribution,
    tab: <FormattedMessage id="data.bonusCenter.userAmountDistribution" />
  },
  {
    key: bonusCenterTabType.costAnalysis,
    tab: <FormattedMessage id="data.bonusCenter.costAnalysis" />
  }
];

export interface SearchParams {
  start_dt?: string;
  end_dt?: string;
  dt?: string; // 开始日期，utc时区yyyy-MM-dd（用于用户银币分布）
  app?: string;
  platform?: string; // 平台（用于用户银币分布）
  user_type?: string;
  start_amount?: number; // 自定义上限余额值（用于用户银币分布）
  end_amount?: number; // 自定义下限余额值（用于用户银币分布）
  is_invited?: string; // 用户邀请类型（用于成本分析数据）
  money_type?: string; // 金币/美金转换按钮（用于成本分析数据）
  source_channel?: string;
  page?: number;
  page_size?: number;
}

export const defaultSearchParams: SearchParams = {
  start_dt: '',
  end_dt: '',
  app: '',
  user_type: bonusCenterUserType.all,
  source_channel: '',
  page: 1,
  page_size: 100
};

export const userTypeOptions = [
  // 全部用户
  {
    label: <FormattedMessage id="data.welfare.all" />,
    value: bonusCenterUserType.all
  },
  {
    label: <FormattedMessage id="data.welfare.new" />,
    value: bonusCenterUserType.new
  },
  {
    label: <FormattedMessage id="data.welfare.old" />,
    value: bonusCenterUserType.old
  }
];

// 用户邀请类型选项（用于成本分析数据）
export const isInvitedOptions = [
  {
    label: <FormattedMessage id="common.base.all" />,
    value: ''
  },
  {
    label: <FormattedMessage id="data.bonusCenter.costAnalysisData.isInvited.yes" />,
    value: '1'
  },
  {
    label: <FormattedMessage id="data.bonusCenter.costAnalysisData.isInvited.no" />,
    value: '0'
  }
];

// 金币/美金转换选项（用于成本分析数据）
export const moneyTypeOptions = [
  {
    label: <FormattedMessage id="data.bonusCenter.costAnalysisData.moneyType.coin" />,
    value: 'coin'
  },
  {
    label: <FormattedMessage id="data.bonusCenter.costAnalysisData.moneyType.usd" />,
    value: 'usd'
  }
];
