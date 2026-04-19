export const dashboardOperationsRoutes = [
  {
    name: '游戏用户场景统计',
    path: '/dataDashboard/gameUserScene',
    component: './dataDashboard/gameUserScene'
  },
  {
    name: '薪资管理',
    path: '/dataDashboard/salary',
    routes: [
      {
        name: '薪资看板',
        path: '/dataDashboard/salary/salaryData',
        component: './dataDashboard/salary/salaryData'
      },
      {
        name: '薪资配置',
        path: '/dataDashboard/salary/salaryConfig',
        component: './dataDashboard/salary/salaryConfig'
      }
    ]
  },
  {
    path: '/dataDashboard/fission',
    name: 'fission',
    routes: [
      {
        name: 'invitees list',
        path: '/dataDashboard/fission/invitees',
        component: './fission/socialFission/invitees'
      },
      {
        name: '裂变数据',
        path: '/dataDashboard/fission/fissionData',
        component: './dataDashboard/fission/fissionData'
      },
      {
        name: '主播裂变数据',
        path: '/dataDashboard/fission/anchorFission',
        component: './dataDashboard/fission/anchorFission'
      },
      {
        name: '用户裂变数据',
        path: '/dataDashboard/fission/userFission',
        component: './dataDashboard/fission/userFission'
      },
      {
        name: '卢比数据',
        path: '/dataDashboard/fission/rupeeStat',
        component: './dataDashboard/fission/rupeeStat'
      },
      {
        name: '裂变漏斗数据',
        path: '/dataDashboard/fission/funnel',
        component: './dataDashboard/fission/funnel'
      },
      {
        name: '自动私聊统计',
        path: '/dataDashboard/fission/autoMsgStat',
        component: './dataDashboard/fission/autoMsgStat'
      },
      {
        name: '私聊统计',
        path: '/dataDashboard/fission/privateChatStat',
        component: './dataDashboard/fission/privateChatStat'
      },
      {
        name: '用户启动App途径统计',
        path: '/dataDashboard/fission/startAppStat',
        component: './dataDashboard/fission/startAppStat'
      },
      {
        name: '解锁post裂变报表',
        path: '/dataDashboard/fission/postFission',
        component: './dataDashboard/fission/postFission'
      },
      {
        name: '直播分享看播报表',
        path: '/dataDashboard/fission/liveSharing',
        component: './dataDashboard/fission/liveSharing'
      },
      {
        name: '裂变用户质量',
        path: '/dataDashboard/fission/inviteeQuality',
        component: './dataDashboard/fission/inviteeQuality'
      },
      {
        name: 'Invitees & 裂变用户质量（大数据）',
        path: '/dataDashboard/fission/inviteeQualityBigData',
        component: './dataDashboard/fission/inviteeQualityBigData'
      },
      {
        name: '裂变承接报表',
        path: '/dataDashboard/fission/adjReport',
        component: './dataDashboard/fission/adjReport'
      }
    ]
  },
  {
    name: '投放管理',
    path: '/dataDashboard/marketing',
    routes: [
      {
        name: '落地页投放',
        path: '/dataDashboard/marketing/launch',
        component: './dataDashboard/marketing/launch'
      },
      {
        name: '投放成效录入',
        path: '/dataDashboard/marketing/adPlacement',
        component: './dataDashboard/marketing/adPlacement'
      },
      {
        name: '投放成效看板',
        path: '/dataDashboard/marketing/performance',
        component: './dataDashboard/marketing/performance'
      }
    ]
  },
  {
    name: '直播数据',
    path: '/dataDashboard/live',
    routes: [
      {
        name: '贵族看板',
        path: '/dataDashboard/live/noble',
        routes: [
          {
            name: '贵族数据看板',
            path: '/dataDashboard/live/noble/nobleDashboard',
            component: './dataDashboard/live/noble/nobleDashboard'
          },
          {
            name: '贵族用户明细看板',
            path: '/dataDashboard/live/noble/nobleDetail',
            component: './dataDashboard/live/noble/nobleDetail'
          }
        ]
      },
      {
        name: '直播数据明细',
        path: '/dataDashboard/live/liveData',
        component: './dataDashboard/live/liveData'
      },
      {
        name: '新增次留用户看直播明细',
        path: '/dataDashboard/live/retainData',
        component: './dataDashboard/live/retainData'
      },
      {
        name: '直播核心数据',
        path: '/dataDashboard/live/core',
        component: './dataDashboard/live/core'
      },
      {
        name: '财富等级分析表',
        path: '/dataDashboard/live/wealthLevel',
        component: './dataDashboard/live/wealthLevel'
      }
    ]
  },
  {
    name: 'PK数据',
    path: '/dataDashboard/pkData',
    component: './dataDashboard/pkData'
  },
  {
    name: '粉丝团数据',
    path: '/dataDashboard/fanClub',
    routes: [
      {
        name: '每日统计数据',
        path: '/dataDashboard/fanClub/everyDay',
        component: './dataDashboard/fanClub/everyDay'
      },
      {
        name: '各等级数据',
        path: '/dataDashboard/fanClub/grade',
        component: './dataDashboard/fanClub/grade'
      },
      {
        name: '消费渗透数据',
        path: '/dataDashboard/fanClub/giftGiving',
        component: './dataDashboard/fanClub/giftGiving'
      }
    ]
  },
  {
    name: '福利中心数据',
    path: '/dataDashboard/welfare',
    routes: [
      {
        name: '任务渗透数据看板',
        path: '/dataDashboard/welfare/permeate',
        component: './dataDashboard/welfare/permeate'
      },
      {
        name: '邀请Invite相关数据',
        path: '/dataDashboard/welfare/invitation',
        component: './dataDashboard/welfare/invitation'
      },
      {
        name: '新增裂变用户相关数据',
        path: '/dataDashboard/welfare/fission',
        component: './dataDashboard/welfare/fission'
      },
      {
        name: '核心大盘数据',
        path: '/dataDashboard/welfare/core',
        component: './dataDashboard/welfare/core'
      },
      {
        name: 'Earn Rupee数据',
        path: '/dataDashboard/welfare/earnRupee',
        component: './dataDashboard/welfare/earnRupee'
      },
      {
        name: '提现相关数据',
        path: '/dataDashboard/welfare/withdrawal',
        component: './dataDashboard/welfare/withdrawal'
      },
      {
        name: '成本数据',
        path: '/dataDashboard/welfare/cost',
        component: './dataDashboard/welfare/cost'
      },
      {
        name: '签到数据',
        path: '/dataDashboard/welfare/signIn',
        component: './dataDashboard/welfare/signIn'
      },
      {
        name: '任务完成明细',
        path: '/dataDashboard/welfare/task',
        component: './dataDashboard/welfare/task'
      },
      {
        name: 'unlockRupees模块相关数据',
        path: '/dataDashboard/welfare/unlockRupee',
        component: './dataDashboard/welfare/unlockRupee'
      },
      {
        name: '各业务分享相关数据',
        path: '/dataDashboard/welfare/share',
        component: './dataDashboard/welfare/share'
      },
      {
        name: 'BonusCenter埋点数据',
        path: '/dataDashboard/welfare/bonusCenter',
        component: './dataDashboard/welfare/bonusCenter'
      },
      {
        name: '包裹兑换配置后台',
        path: '/dataDashboard/welfare/exchangeMall',
        component: './dataDashboard/welfare/exchangeMall'
      }
    ]
  },
  {
    name: '任务数据',
    path: '/dataDashboard/task',
    routes: [
      {
        name: 'Rising Star主播任务日志',
        path: '/dataDashboard/task/anchorTaskLog',
        component: './dataDashboard/task/anchorTaskLog'
      },
      {
        name: 'Rising Star主播任务日统计',
        path: '/dataDashboard/task/anchorStatistics',
        component: './dataDashboard/task/anchorStatistics'
      }
    ]
  },
  {
    name: '新增看板',
    path: '/dataDashboard/newBoard',
    routes: [
      {
        name: '新用户路径漏斗',
        path: '/dataDashboard/newBoard/userFunnel',
        component: './dataDashboard/newBoard/userFunnel'
      },
      {
        name: '分场景留存',
        path: '/dataDashboard/newBoard/scenesRetention',
        component: './dataDashboard/newBoard/scenesRetention'
      },
      {
        name: '新用户充值看板',
        path: '/dataDashboard/newBoard/userRecharge',
        component: './dataDashboard/newBoard/userRecharge'
      }
    ]
  },
  {
    name: '活动',
    path: '/dataDashboard/activity',
    routes: [
      {
        name: '星座活动',
        path: '/dataDashboard/activity/zodiac',
        component: './dataDashboard/activity/zodiac'
      },
      {
        name: '排灯节活动',
        path: '/dataDashboard/activity/diwali',
        component: './dataDashboard/activity/diwali'
      },
      {
        name: 'CP活动',
        path: '/dataDashboard/activity/moonlitVows',
        component: './dataDashboard/activity/moonlitVows'
      }
    ]
  },
  {
    name: '报表生成平台',
    path: '/dataDashboard/reportGenerator/*',
    component: './dataDashboard/reportGenerator'
  }
];
