export const configCoreRoutes = [
  {
    name: '资产配置',
    path: '/config/assets',
    routes: [
      {
        name: '头像框配置',
        path: '/config/assets/avatar',
        component: './config/assets/avatar'
      },
      {
        name: '名片卡配置',
        path: '/config/assets/profileSkin',
        component: './config/assets/profileSkin'
      },
      {
        name: '飘带配置',
        path: '/config/assets/ribbon',
        component: './config/assets/ribbon'
      },
      {
        name: '座驾配置',
        path: '/config/assets/car',
        component: './config/assets/car'
      },
      {
        name: 'emoji表情',
        path: '/config/assets/emoji',
        routes: [
          {
            name: '表情配置',
            path: '/config/assets/emoji/edit',
            component: './config/assets/emoji/edit'
          },
          {
            name: '表情分类',
            path: '/config/assets/emoji/cate',
            component: './config/assets/emoji/cate'
          }
        ]
      },
      {
        name: '礼物配置',
        path: '/config/assets/gift',
        component: './config/assets/gift'
      },
      {
        name: '包裹配置',
        path: '/config/assets/package',
        component: './config/assets/package'
      },
      {
        name: '发放包裹',
        path: '/config/assets/manualPackage',
        component: './config/assets/manualPackage'
      },
      {
        name: '聊天气泡配置',
        path: '/config/assets/chatBubble',
        component: './config/assets/chatBubble'
      },
      {
        name: '后台直接发放资产',
        path: '/config/assets/send',
        component: './config/assets/send'
      },
      {
        name: 'PremiumID管理',
        path: '/config/assets/premiumId',
        component: './config/assets/premiumId'
      },
      {
        name: '金币类目配置',
        path: '/config/assets/coinCategory',
        component: './config/assets/coinCategory'
      }
    ]
  },
  {
    name: '批量兑换后台',
    path: '/config/batchExchange',
    component: './config/batchExchange'
  },
  {
    path: '/config/activity',
    name: '活动配置',
    routes: [
      {
        name: '活动可见性配置',
        path: '/config/activity/activityVisible',
        component: './config/activity/activityVisible'
      },
      {
        name: 'Banner管理',
        path: '/config/activity/banner',
        component: './config/activity/banner'
      },
      {
        name: '每日任务',
        path: '/config/activity/dailyTask',
        component: './config/activity/dailyTask'
      },
      {
        name: '成长任务',
        path: '/config/activity/growingTask',
        component: './config/activity/growingTask'
      },
      {
        name: '主播任务',
        path: '/config/activity/anchorTask',
        component: './config/activity/anchorTask'
      },
      {
        name: '幸运礼物周星',
        path: '/config/activity/weekStar',
        component: './config/activity/weekStar'
      },
      {
        name: '时长礼盒',
        path: '/config/activity/durationGiftBox',
        component: './config/activity/durationGiftBox'
      },
      {
        name: '回流活动',
        path: '/config/activity/welcomeBack',
        component: './config/activity/welcomeBack'
      },
      {
        name: 'PK模板活动',
        path: '/config/activity/pkKing',
        component: './config/activity/pkKing'
      },
      {
        name: '榜单系统',
        path: '/config/activity/rankSys',
        component: './config/activity/rankSys'
      },
      {
        name: '任务系统',
        path: '/config/activity/taskSys',
        component: './config/activity/taskSys'
      },
      {
        name: '新年话题活动',
        path: '/config/activity/newYearPost',
        component: './config/activity/newYearPost'
      },
      {
        name: '话题系统',
        path: '/config/activity/topicSys',
        component: './config/activity/topicSys'
      }
    ]
  },
  {
    path: '/config/level',
    name: '等级配置',
    routes: [
      {
        path: '/config/level/userLevel',
        name: '用户等级',
        routes: [
          {
            name: '用户等级配置',
            path: '/config/level/userLevel/edit',
            component: './config/level/userLevel/edit'
          },
          {
            name: '用户等级升级规则',
            path: '/config/level/userLevel/upgradeRule',
            component: './config/level/userLevel/upgradeRule'
          }
        ]
      },
      {
        path: '/config/level/wealthLevel',
        name: '财富等级',
        routes: [
          {
            name: '财富等级配置',
            path: '/config/level/wealthLevel/edit',
            component: './config/level/wealthLevel/edit'
          },
          {
            name: '财富等级升级规则',
            path: '/config/level/wealthLevel/upgradeRule',
            component: './config/level/wealthLevel/upgradeRule'
          }
        ]
      }
    ]
  },
  {
    name: '直播间配置',
    path: '/config/room',
    routes: [
      {
        name: '欢迎语管理',
        path: '/config/room/greeting',
        component: './config/room/greeting'
      },
      {
        name: '贴纸管理',
        path: '/config/room/sticker',
        component: './config/room/sticker'
      },
      {
        name: '直播间banner',
        path: '/config/room/banner',
        component: './config/room/banner'
      },
      {
        name: '音乐管理',
        path: '/config/room/music',
        component: './config/room/music'
      },
      {
        name: '直播分类配置',
        path: '/config/room/liveTags',
        component: './config/room/liveTags'
      },
      {
        name: '解说带单直播配置',
        path: '/config/room/villager',
        component: './config/room/villager'
      },
      {
        name: '语聊房基础配置',
        path: '/config/room/chatPartyBasicConfig',
        component: './config/room/chatPartyBasicConfig'
      },
      {
        name: 'AI带单直播间配置',
        path: '/config/room/aiAnchor',
        component: './config/room/aiAnchor'
      }
    ]
  },
  {
    path: '/config/gift',
    name: '礼物管理',
    routes: [
      {
        name: '礼物菜单',
        path: '/config/gift/giftMenu',
        component: './config/gift/giftMenu'
      },
      {
        name: '礼物上架状态',
        path: '/config/gift/giftAppStatus',
        component: './config/gift/giftAppStatus'
      }
    ]
  },
  {
    name: '充值管理',
    path: '/config/payment',
    routes: [
      {
        name: '广告位',
        path: '/config/payment/promotion',
        component: './config/payment/promotion'
      },
      {
        name: '充值商品',
        path: '/config/payment/sku',
        component: './config/payment/sku'
      },
      {
        name: '充值订单',
        path: '/config/payment/order',
        component: './config/payment/order'
      },
      {
        name: '订单补单',
        path: '/config/payment/replenishment',
        component: './config/payment/replenishment'
      },
      {
        name: '首充配置',
        path: '/config/payment/firstRecharge',
        component: './config/payment/firstRecharge'
      },
      {
        name: '支付渠道',
        path: '/config/payment/channel',
        component: './config/payment/channel'
      },
      {
        name: '充值订单反馈',
        path: '/config/payment/feedback',
        component: './config/payment/feedback'
      },
      {
        name: '提现订单',
        path: '/config/payment/withdraw',
        component: './config/payment/withdraw'
      },
      {
        name: '工单回复',
        path: '/config/payment/worksheet',
        component: './config/payment/worksheet'
      },
      {
        name: '钱包路由管理',
        path: '/config/payment/walletRouting',
        component: './config/payment/walletRouting'
      },
      {
        name: '回调重放',
        path: '/config/payment/callbackReplay',
        component: './config/payment/callbackReplay'
      },
      {
        name: '带玩主播白名单',
        path: '/config/payment/anchorGameWhite',
        component: './config/payment/anchorGameWhite'
      }
    ]
  },
];
