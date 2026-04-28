export const configFeaturesRoutes = [
  {
    name: '徽章管理',
    path: '/config/badge',
    routes: [
      {
        name: '徽章配置',
        path: '/config/badge/setting',
        component: './config/badge/setting'
      }
    ]
  },
  {
    name: '体验卡管理',
    path: '/config/experienceCard',
    routes: [
      {
        name: '体验卡配置',
        path: '/config/experienceCard/setting',
        component: './config/experienceCard/setting'
      }
    ]
  },
  {
    name: '弹窗管理',
    path: '/config/popup',
    routes: [
      {
        name: '版本弹窗',
        path: '/config/popup/version',
        component: './config/popup/version'
      },
      {
        name: '活动弹窗',
        path: '/config/popup/activity',
        component: './config/popup/activity'
      }
    ]
  },
  {
    name: 'VIP管理',
    path: '/config/vip',
    routes: [
      {
        name: 'VIP看板',
        path: '/config/vip/dashboard',
        component: './config/vip/dashboard'
      },
      {
        name: 'VIP等级详情',
        path: '/config/vip/levelDetail',
        component: './config/vip/levelDetail'
      },
      {
        name: 'VIP配置',
        path: '/config/vip/setting',
        component: './config/vip/setting'
      },
      {
        name: '等级配置',
        path: '/config/vip/levelConf',
        component: './config/vip/levelConf'
      },
      {
        name: '等级权益配置',
        path: '/config/vip/privilege',
        component: './config/vip/privilege'
      },
      {
        name: 'VIP用户名单',
        path: '/config/vip/userList',
        component: './config/vip/userList'
      }
    ]
  },
  {
    name: '贵族管理',
    path: '/config/noble',
    routes: [
      {
        name: '贵族配置',
        path: '/config/noble/setting',
        component: './config/noble/setting'
      }
    ]
  },
  {
    name: 'Push管理',
    path: '/config/push',
    routes: [
      {
        name: 'Push配置',
        path: '/config/push/setting',
        component: './config/push/setting'
      }
    ]
  },
  {
    name: 'Message管理',
    path: '/config/message',
    routes: [
      {
        name: 'Message配置',
        path: '/config/message/setting',
        component: './config/message/setting'
      }
    ]
  },
  {
    name: '夺宝配置',
    path: '/config/treasure',
    component: './config/treasure'
  },
  {
    name: '订阅管理',
    path: '/config/subscription',
    component: './config/subscription'
  },
  {
    name: '编辑器管理',
    path: '/config/editor',
    routes: [
      {
        name: '编辑器滤镜',
        path: '/config/editor/filter',
        component: './config/editor/filter'
      },
      {
        name: '编辑器贴纸',
        path: '/config/editor/sticker',
        component: './config/editor/sticker'
      },
      {
        name: '编辑器字体',
        path: '/config/editor/font',
        component: './config/editor/font'
      },
      {
        name: '模板配置',
        path: '/config/editor/template',
        component: './config/editor/template'
      },
      {
        name: '美颜配置',
        path: '/config/editor/beauty',
        component: './config/editor/beauty'
      },
      {
        name: '特效美颜',
        path: '/config/editor/rtEffect',
        component: './config/editor/rtEffect'
      }
    ]
  },
  {
    name: '广告配置',
    path: '/config/ad',
    routes: [
      {
        name: '开屏广告',
        path: '/config/ad/splash',
        component: './config/ad/splash'
      }
    ]
  },
  {
    name: '粉丝团配置',
    path: '/config/fanClub',
    routes: [
      {
        name: '粉丝团特权',
        path: '/config/fanClub/fanClub',
        component: './config/fanClub/fanClub'
      },
      {
        name: '粉丝团亲密度规则',
        path: '/config/fanClub/fanIntimacy',
        component: './config/fanClub/fanIntimacy'
      },
      {
        name: '粉丝进场特效',
        path: '/config/fanClub/fansEnter',
        component: './config/fanClub/fansEnter'
      },
      {
        name: '粉丝铭牌',
        path: '/config/fanClub/fanNameplate',
        component: './config/fanClub/fanNameplate'
      }
    ]
  },
  {
    name: '自定义配置',
    path: '/config/:key',
    component: './tool/customConfig'
  },
  {
    name: '象神祈福配置',
    path: '/config/bonusWish',
    component: './config/bonusWish'
  },
  {
    name: '福利中心配置',
    path: '/config/welfare',
    routes: [
      {
        name: '领取卢比福利数值配置',
        path: '/config/welfare/claimRupees',
        component: './config/welfare/claimRupees'
      },
      {
        name: '解锁卢比提现额度配置',
        path: '/config/welfare/unlockRupees',
        component: './config/welfare/unlockRupees'
      },
      {
        name: '渠道签到奖励配置',
        path: '/config/welfare/checkInChannelConf',
        component: './config/welfare/checkInChannelConf'
      }
    ]
  },
  {
    name: '世界频道',
    path: '/config/worldChannel',
    component: './config/worldChannel'
  },
  {
    name: '动画配置',
    path: '/config/animation',
    component: './config/animation'
  },
  {
    name: 'bonus_center签到管理',
    path: '/config/bonusCenter/signIn',
    component: './config/bonusCenter/signIn'
  },
  {
    name: 'bonus_center代理风控',
    path: '/config/bonusCenter/fissionRisk',
    component: './config/bonusCenter/fissionRisk'
  }
];
