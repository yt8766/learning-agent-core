export const dashboardAnalyticsRoutes = [
  {
    name: 'Banner报表',
    path: '/dataDashboard/banner',
    component: './dataDashboard/banner'
  },
  {
    name: 'PK瓜分报表',
    path: '/dataDashboard/pkJackpot',
    component: './dataDashboard/pkJackpot'
  },
  {
    name: '核心数据',
    path: '/dataDashboard/core',
    component: './dataDashboard/core'
  },
  {
    name: '经营分析',
    path: '/dataDashboard/businessAnalysis',
    component: './dataDashboard/businessAnalysis'
  },
  {
    name: '盈亏分润',
    path: '/dataDashboard/profitAndLoss',
    component: './dataDashboard/profitAndLoss'
  },
  {
    name: 'AI业务日报',
    path: '/dataDashboard/aiBriefing',
    component: './dataDashboard/aiBriefing'
  },
  {
    name: '用户增长数据看板',
    path: '/dataDashboard/userGrowthData',
    component: './dataDashboard/userGrowthData'
  },
  {
    name: '金币追踪',
    path: '/dataDashboard/coinTracker',
    component: './dataDashboard/coinTracker'
  },
  {
    name: 'VIP金币追踪',
    path: '/dataDashboard/vipCoinTracker',
    component: './dataDashboard/vipCoinTracker'
  },
  {
    name: '留存数据',
    path: '/dataDashboard/retention',
    component: './dataDashboard/retention'
  },
  {
    name: '游戏日报',
    path: '/dataDashboard/gamelog',
    routes: [
      {
        name: '按日流水报表',
        path: '/dataDashboard/gamelog/daily',
        component: './dataDashboard/gamelog'
      },
      {
        name: 'Ludo游戏数据',
        path: '/dataDashboard/gamelog/ludo',
        component: './dataDashboard/gamelog/ludo'
      },
      {
        name: 'Top100玩家报表',
        path: '/dataDashboard/gamelog/topPlayer',
        component: './dataDashboard/gamelog/topPlayer'
      },
      {
        name: 'GreedyPro数据报表',
        path: '/dataDashboard/gamelog/greedyPro',
        component: './dataDashboard/gamelog/greedyPro'
      },
      {
        name: 'Yummy报表',
        path: '/dataDashboard/gamelog/yummy',
        component: './dataDashboard/gamelog/yummy'
      },
      {
        name: '游戏券追踪',
        path: '/dataDashboard/gamelog/voucher',
        component: './dataDashboard/gamelog/voucher'
      }
    ]
  },
  {
    name: '金币&现金流向总览',
    path: '/dataDashboard/coinCurrencyOverview',
    component: './dataDashboard/coinCurrencyOverview'
  },
  {
    name: '榜单数据',
    path: '/dataDashboard/rankData',
    routes: [
      {
        name: '充值消费榜',
        path: '/dataDashboard/rankData/recharge',
        component: './dataDashboard/rankData/recharge'
      },
      {
        name: '充值消费榜（新）',
        path: '/dataDashboard/rankData/rechargeConsumeNew',
        component: './dataDashboard/rankData/rechargeConsumeNew'
      }
    ]
  },
  {
    name: '送礼数据',
    path: '/dataDashboard/giftData',
    routes: [
      {
        name: '礼物维度送礼数据',
        path: '/dataDashboard/giftData/giftDimension',
        component: './dataDashboard/giftData/giftDimension'
      },
      {
        name: 'uid维度普通礼物数据',
        path: '/dataDashboard/giftData/uidDimension',
        component: './dataDashboard/giftData/uidDimension'
      },
      {
        name: '送礼日报',
        path: '/dataDashboard/giftData/dailyReport',
        component: './dataDashboard/giftData/dailyReport'
      }
    ]
  },
  {
    name: '用户数据',
    path: '/dataDashboard/userData',
    component: './dataDashboard/userData'
  },
  {
    name: '实时充值数据',
    path: '/dataDashboard/rechargeRealTimeData',
    component: './dataDashboard/rechargeRealTimeData'
  },
  {
    name: '充值统计数据',
    path: '/dataDashboard/rechargeData',
    component: './dataDashboard/rechargeData'
  },
  {
    name: '游戏用户场景统计',
    path: '/dataDashboard/gameUserScene',
    component: './dataDashboard/gameUserScene'
  },
  {
    name: 'Bonus Center数据',
    path: '/dataDashboard/bonusCenterData',
    component: './dataDashboard/bonusCenterData'
  },
  {
    name: 'Bonus签到&小组件数据',
    path: '/dataDashboard/bonusSignWidgetData',
    component: './dataDashboard/bonusSignWidgetData'
  },
  {
    name: '生产消费',
    path: '/dataDashboard/postConsumption',
    // component: './dataDashboard/postConsumption',
    routes: [
      {
        name: 'Post指标',
        path: '/dataDashboard/postConsumption/postMetrics',
        component: './dataDashboard/postConsumption/postMetrics'
      },
      {
        name: 'Post生产&消费数据看板',
        path: '/dataDashboard/postConsumption/creatorConsumeBoard',
        component: './dataDashboard/postConsumption/creatorConsumeBoard'
      },
      {
        name: 'Post数据统计',
        path: '/dataDashboard/postConsumption/postStats',
        component: './dataDashboard/postConsumption/postStats'
      },
      {
        name: 'Post插入统计',
        path: '/dataDashboard/postConsumption/postInsertStats',
        component: './dataDashboard/postConsumption/postInsertStats'
      },
      {
        name: 'Ugc生产数据统计',
        path: '/dataDashboard/postConsumption/ugcProduction',
        component: './dataDashboard/postConsumption/ugcProduction'
      },
      {
        name: 'UGC数据统计',
        path: '/dataDashboard/postConsumption/postAiStats',
        component: './dataDashboard/postConsumption/postAiStats'
      },
      {
        name: 'UGC功能报表',
        path: '/dataDashboard/postConsumption/ugcReport',
        component: './dataDashboard/postConsumption/ugcReport'
      },
      {
        name: '内容分类新增统计报表',
        path: '/dataDashboard/postConsumption/contentCategory',
        component: './dataDashboard/postConsumption/contentCategory'
      },
      {
        name: 'Post分享',
        path: '/dataDashboard/postConsumption/postShare',
        component: './dataDashboard/postConsumption/postShare'
      },
      {
        name: 'Post流量分发',
        path: '/dataDashboard/postConsumption/postTrafficDistribution',
        component: './dataDashboard/postConsumption/postTrafficDistribution'
      },
      {
        name: '付费POST解锁',
        path: '/dataDashboard/postConsumption/paidPostUnlock',
        component: './dataDashboard/postConsumption/paidPostUnlock'
      },
      {
        name: 'Post体验监控面板',
        path: '/dataDashboard/postConsumption/postExperienceMonitor',
        component: './dataDashboard/postConsumption/postExperienceMonitor'
      },
      {
        name: 'Post品类TGI偏好分析',
        path: '/dataDashboard/postConsumption/postTagTgi',
        component: './dataDashboard/postConsumption/postTagTgi'
      },
      {
        name: 'Hash Tag',
        path: '/dataDashboard/postConsumption/hashTag',
        component: './dataDashboard/postConsumption/hashTag'
      },
      {
        name: '分享看板',
        path: '/dataDashboard/postConsumption/shareAnalytics',
        component: './dataDashboard/shareAnalytics'
      }
    ]
  },
  {
    name: 'H5数据看板',
    path: '/dataDashboard/h5Dashboard',
    component: './dataDashboard/h5Dashboard'
  },
  {
    name: '玩法数据',
    path: '/dataDashboard/gameData',
    routes: [
      {
        name: '直播间宝箱',
        path: '/dataDashboard/gameData/roomTreasure',
        component: './dataDashboard/gameData/roomTreasure'
      },
      {
        name: '欲望之轮',
        path: '/dataDashboard/gameData/desireWheel',
        component: './dataDashboard/gameData/desireWheel'
      },
      {
        name: '时长礼盒数据',
        path: '/dataDashboard/gameData/durationGiftBox',
        component: './dataDashboard/gameData/durationGiftBox'
      },
      {
        name: '俸禄数据',
        path: '/dataDashboard/gameData/rebate',
        component: './dataDashboard/gameData/rebate'
      },
      {
        name: '红包玩法（Lucky Coins）',
        path: '/dataDashboard/gameData/luckyCoins',
        component: './dataDashboard/gameData/luckyCoins'
      },
      {
        name: '每日pk数据统计',
        path: '/dataDashboard/gameData/dailyPk',
        component: './dataDashboard/gameData/dailyPk'
      },
      {
        name: '付费房试看券数据分析看板',
        path: '/dataDashboard/gameData/voucherData',
        component: './dataDashboard/gameData/voucherData'
      },
      {
        name: '直播间玩游戏分析报表',
        path: '/dataDashboard/gameData/liveGameAnalysis',
        component: './dataDashboard/gameData/liveGameAnalysis'
      }
    ]
  }
];
