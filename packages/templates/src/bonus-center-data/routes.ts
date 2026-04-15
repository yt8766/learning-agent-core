// @ts-nocheck
import { MenuDataItem } from '@ant-design/pro-components';
// import locales from './locales';

const routes: MenuDataItem = [
  /* base routes */
  {
    path: '/',
    redirect: '/home',
    resident: true
  },
  {
    path: '/403',
    resident: true,
    component: './403',
    headerRender: false,
    footerRender: false,
    menuRender: false,
    hideInMenu: true,
    hideInBreadcrumb: true
  },
  {
    path: '/home',
    component: './home',
    name: 'Home',
    resident: true
  },
  {
    name: 'app下载页',
    path: '/download',
    component: './appDownload',
    hideInMenu: true,
    resident: true
  },
  {
    path: '/system',
    name: 'CMS系统配置',
    routes: [
      {
        name: '用户管理',
        path: '/system/user',
        component: './system/user'
      },
      {
        name: '角色管理',
        path: '/system/role',
        component: './system/role'
      },
      {
        name: '菜单管理',
        path: '/system/menu',
        component: './system/menu'
      }
    ]
  },
  {
    path: '/payment',
    name: '付款工单',
    routes: [
      {
        name: '工单列表',
        path: '/payment/workOrder',
        component: './payment/workOrder'
      },
      {
        name: '审批流配置',
        path: '/payment/approvalFlow',
        component: './payment/approvalFlow'
      },
      {
        name: '工单付款统计',
        path: '/payment/statistics',
        component: './payment/statistics'
      }
    ]
  },
  {
    path: '/json',
    component: './json',
    title: 'json页面'
  },
  {
    path: '/user',
    name: '用户管理',
    routes: [
      {
        name: '用户查询',
        path: '/user/search',
        component: './user/search'
      },
      {
        name: '名单配置',
        path: '/user/list',
        component: './user/list'
      },
      {
        name: '长列表名单配置',
        path: '/user/longListConfig',
        component: './user/longListConfig'
      },
      {
        name: '审核配置',
        path: '/user/review',
        component: './user/review'
      },
      {
        name: '修改金币',
        path: '/user/modifyCoin',
        component: './user/modifyCoin'
      },

      {
        name: '流失用户',
        path: '/user/lose',
        component: './user/lose'
      },
      {
        name: 'sms验证码',
        path: '/user/sms',
        component: './user/sms'
      },
      {
        name: 'sms个人码',
        path: '/user/personalCode',
        component: './user/personalCode'
      },
      {
        name: '聊天记录',
        path: '/user/chat',
        component: './user/chat'
      },
      {
        name: '风险用户管理',
        path: '/user/risk',
        component: './user/risk'
      },
      {
        name: '埋点后台',
        path: '/user/event-tracking',
        component: './user/event-tracking'
      }
    ]
  },
  {
    path: '/live',
    name: '直播管理',
    routes: [
      {
        name: '直播记录',
        path: '/live/record',
        component: './live/record'
      },
      {
        name: '结算汇总',
        path: '/live/settle',
        component: './live/settle'
      },
      {
        name: 'liveHouse',
        path: '/live/liveHouse',
        routes: [
          {
            name: 'liveHouse账号配置',
            path: '/live/liveHouse/account',
            component: './live/liveHouse/account'
          },

          {
            name: 'liveHouse位置配置',
            path: '/live/liveHouse/position',
            component: './live/liveHouse/position'
          }
        ]
      },
      {
        name: '节目单',
        path: '/live/programme',
        component: './live/programme'
      }
    ]
  },
  {
    name: '反馈管理',
    path: '/feedback',
    routes: [
      {
        name: '用户反馈',
        path: '/feedback/userFeedback',
        component: './feedback/userFeedback'
      },
      {
        name: 'app日志',
        path: '/feedback/appLog',
        component: './feedback/appLog'
      }
    ]
  },
  {
    name: '实验管理平台',
    path: '/experiment',
    routes: [
      {
        name: '项目管理',
        path: '/experiment/project',
        component: './experiment/project'
      },
      {
        name: '实验层管理',
        path: '/experiment/layer',
        component: './experiment/layer'
      },
      {
        name: '实验管理',
        path: '/experiment/list',
        component: './experiment/list'
      },
      {
        name: '动态配置',
        path: '/experiment/dynamicConfig',
        component: './experiment/dynamicConfig'
      }
    ]
  },
  {
    name: '配置项',
    path: '/config',
    routes: [
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
    ]
  },
  {
    path: '/guildmg',
    name: '直播管理',
    routes: [
      {
        name: '公会BD管理',
        path: '/guildmg/guildbd',
        component: './guildmg/GuildBD'
      },
      {
        name: '公会管理',
        path: '/guildmg/guild',
        component: './guildmg/Guild'
      },
      {
        name: '主播管理',
        path: '/guildmg/anchor',
        component: './guildmg/Anchor'
      },
      {
        name: '拍客管理',
        path: '/guildmg/photographer',
        component: './guildmg/photographer'
      }
    ]
  },
  {
    name: 'app发版列表',
    path: '/appVersion',
    component: './appVersion'
  },
  {
    name: '操作日志记录',
    routes: [
      {
        name: '全部',
        path: '/operateLog/all',
        component: './operateLog/all'
      },
      {
        name: '审核 - 操作日志记录',
        path: '/operateLog/audit',
        component: './operateLog/audit'
      }
    ]
  },
  {
    name: '活动配置后台',
    routes: [
      {
        name: '活动配置',
        path: '/activity/index',
        component: './activity/index'
      }
    ]
  },
  {
    name: '开发者工具',
    path: '/tool',
    routes: [
      {
        name: '通用配置',
        path: '/tool/universal',
        component: './tool/universal'
      },
      {
        name: '上传文件',
        path: '/tool/upload',
        component: './tool/upload'
      },
      {
        name: '翻译后台',
        path: '/tool/translate',
        component: './tool/translate'
      },
      {
        name: '短链',
        path: '/tool/shortChain',
        component: './tool/shortChain'
      },
      {
        name: '短链',
        path: '/tool/custom',
        component: './tool/custom'
      },
      {
        name: 'pprof',
        path: '/tool/pprof',
        component: './tool/pprof'
      },
      {
        name: 'AI知识助手',
        path: '/tool/aiAssistant',
        component: './tool/aiAssistant'
      },
      {
        name: 'Post批量上传',
        path: '/tool/postBatchUpload',
        component: './tool/postBatchUpload'
      },
      {
        name: '图集上传',
        path: '/tool/atlasUpload',
        component: './tool/atlasUpload'
      },
      {
        name: '短剧上传',
        path: '/tool/dramaUpload',
        component: './tool/dramaUpload'
      },
      {
        name: '接口调用次数看板',
        path: '/tool/apiCallCount',
        component: './tool/ApiCallCount'
      }
    ]
  },
  {
    path: '/audit',
    name: '审查后台',
    routes: [
      {
        name: '动态审核',
        path: '/audit/moment',
        component: './audit/Moment'
      },
      {
        name: 'UGC用户审核',
        path: '/audit/ugcUserAudit',
        component: './audit/ugcUserAudit'
      },
      {
        name: '敏感词',
        path: '/audit/sensitive',
        component: './audit/sensitive'
      },
      {
        name: '直播审核',
        path: '/audit/liveReview',
        component: './audit/liveReview'
      },
      {
        name: '封禁管理',
        path: '/audit/ban',
        component: './audit/ban'
      },
      {
        name: '申请解除封禁列表',
        path: '/audit/banApply',
        component: './audit/banApply'
      },
      {
        name: '举报管理',
        path: '/audit/report',
        component: './audit/report'
      },
      {
        name: '举报管理（汇总）',
        path: '/audit/reportSummary',
        component: './audit/reportSummary'
      },
      {
        name: '个人信息审核',
        path: '/audit/userAudit',
        component: './audit/userAudit'
      },
      {
        name: '主播资料审核',
        path: '/audit/anchorAudit',
        component: './audit/anchorAudit'
      },
      {
        name: '优质主播',
        path: '/audit/superiorAnchor',
        component: './audit/superiorAnchor'
      },
      {
        name: '警告记录',
        path: '/audit/warning',
        component: './audit/warning'
      },
      {
        name: '主播踢出/禁言记录',
        path: '/audit/kick',
        component: './audit/kick'
      },
      {
        name: 'KYC审核',
        path: '/audit/kycAudit',
        component: './audit/kycAudit'
      },
      {
        name: 'Post审核',
        path: '/audit/postReview',
        routes: [
          {
            name: '审核详情',
            path: '/audit/postReview/overview',
            component: './audit/postReview/overview'
          },
          {
            name: '审核操作',
            path: '/audit/postReview/operate',
            component: './audit/postReview/operate',
            hideInMenu: true
          },
          {
            name: '审核记录',
            path: '/audit/postReview/history',
            component: './audit/postReview/history'
          },
          {
            name: '审核数据',
            path: '/audit/postReview/dashboard',
            component: './audit/postReview/dashboard'
          },
          {
            name: '审核员详情',
            path: '/audit/postReview/auditorDetail',
            component: './audit/postReview/auditorDetail',
            hideInMenu: true
          },
          {
            name: '质检记录',
            path: '/audit/postReview/qualityRecord',
            component: './audit/postReview/qualityRecord'
          },
          {
            name: '质检操作',
            path: '/audit/postReview/qualityOperate',
            component: './audit/postReview/qualityOperate',
            hideInMenu: true
          },
          {
            name: '质量评级',
            path: '/audit/postReview/qualityGrade',
            component: './audit/postReview/qualityGrade',
            hideInMenu: true
          }
          // {
          //   name: '质检历史',
          //   path: '/audit/postReview/qualityHistory',
          //   component: './audit/postReview/qualityHistory',
          //   hideInMenu: true,
          // },
        ]
      },
      {
        name: 'Post搜索',
        path: '/audit/postSearch',
        component: './audit/postSearch'
      },
      {
        name: 'Post详情',
        path: '/audit/postSearch/detail/:id',
        component: './audit/postSearch/detail',
        hideInMenu: true
      }
    ]
  },
  {
    path: '/reseller',
    name: '币商管理',
    routes: [
      {
        name: '币商列表',
        path: '/reseller/coin',
        component: './reseller/coin'
      },
      {
        name: '充值记录',
        path: '/reseller/recharge',
        component: './reseller/recharge'
      },
      {
        name: '渠道管理',
        path: '/reseller/channel',
        component: './reseller/channel'
      },
      {
        name: '转账记录',
        path: '/reseller/transfer',
        component: './reseller/transfer'
      }
    ]
  },
  {
    path: '/game',
    name: '游戏管理',
    routes: [
      {
        name: '游戏管理',
        path: '/game/game',
        component: './game/game'
      },
      {
        name: '游戏分类管理',
        path: '/game/classify',
        component: './game/classify'
      }
      // {
      //   name: '游戏记录',
      //   path: '/game/gameRecords',
      //   component: './game/gameRecords',
      // },
    ]
  },
  {
    path: '/dataDashboard',
    name: '数据看板',
    routes: [
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
      },
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
    ]
  },
  {
    path: '/paymentReport',
    name: '支付管理与报表功能',
    routes: [
      {
        name: '充值报表',
        path: '/paymentReport/rechargeReport',
        routes: [
          {
            name: '财务对账报表',
            path: '/paymentReport/rechargeReport/financeReconciliation',
            component: './paymentReport/rechargeReport/financeReconciliation'
          },
          {
            name: '渠道质量与漏斗分析看板',
            path: '/paymentReport/rechargeReport/channelFunnelAnalysis',
            component: './dataDashboard/payment/channelFunnelAnalysis'
          }
        ]
      }
    ]
  },
  {
    name: '内容管理',
    path: '/content',
    routes: [
      {
        name: '任务管理',
        path: '/content/taskConfig',
        component: './content/taskConfig'
      },
      {
        name: '账号管理',
        path: '/content/accounts',
        component: './content/accounts'
      },
      {
        name: '内容池',
        path: '/content/contentPool',
        component: './content/contentPool'
      },
      {
        name: '热点管理配置',
        path: '/content/hotConfig',
        component: './content/hotConfig'
      },
      {
        name: '短剧管理',
        path: '/content/drama',
        component: './content/drama'
      },
      {
        name: '搜索品类配置',
        path: '/content/searchPostCate',
        component: './content/searchPostCate'
      }
      // {
      //   name: '发布记录',
      //   path: '/content/publishRecords',
      //   component: './content/publishRecords',
      // },
      // {
      //   name: '数据统计',
      //   path: '/content/statistics',
      //   component: './content/statistics',
      // },
    ]
  },
  {
    name: '标签管理',
    path: '/tag',
    routes: [
      {
        name: 'creator标签管理',
        path: '/tag/creatorTag',
        component: './tag/creatorTag'
      },
      {
        name: 'post标签管理',
        path: '/tag/postTag',
        component: './tag/postTag'
      },
      {
        name: '标签管理',
        path: '/tag/tag',
        component: './tag/tag'
      },
      {
        name: '兴趣标签',
        path: '/tag/interestTag',
        component: './tag/interestTag'
      }
    ]
  },
  {
    name: '裂变管理',
    path: '/fission',
    routes: [
      {
        name: '提现商品管理',
        path: '/fission/commodity',
        component: './fission/commodity'
      },
      {
        name: '提现订单管理',
        path: '/fission/order',
        component: './fission/order'
      },
      {
        name: '提现用户信息',
        path: '/fission/user',
        component: './fission/user'
      },
      {
        name: '实物配置',
        path: '/fission/physical',
        component: './fission/physical'
      },
      {
        name: '签到抽奖配置',
        path: '/fission/signin',
        component: './fission/signin'
      },
      {
        name: '宝箱抽奖数据',
        path: '/fission/treasureBox',
        component: './fission/treasureBox'
      },
      {
        name: '签到数据',
        path: '/fission/signinData',
        component: './fission/signinData'
      },
      {
        name: '转盘抽奖裂变奖励配置',
        path: '/fission/spin',
        component: './fission/spin'
      },
      {
        name: '社媒裂变管理',
        path: '/fission/socialFission',
        routes: [
          {
            name: '链接',
            path: '/fission/socialFission/link',
            component: './fission/socialFission/link'
          },
          {
            name: '奖励记录',
            path: '/fission/socialFission/reward',
            component: './fission/socialFission/reward'
          }
        ]
      },
      {
        name: 'UGC裂变活动',
        path: '/fission/ugcTeam',
        component: './fission/ugcTeam'
      }
    ]
  },
  {
    name: 'AI管理',
    path: '/ai',
    routes: [
      {
        name: 'AI女友',
        path: '/ai/girlfriend',
        component: './ai/girlfriend'
      },
      {
        name: 'AI女友需求报表',
        path: '/ai/girlfriendReport',
        component: './ai/girlfriendReport'
      },
      {
        name: 'AI玄学报表',
        path: '/ai/fortuneReport',
        component: './ai/fortuneReport'
      }
    ]
  },
  {
    name: '推荐系统',
    path: '/recommendation',
    routes: [
      {
        name: '分析平台',
        path: '/recommendation/analysis',
        routes: [
          {
            name: '推荐模拟',
            path: '/recommendation/analysis/debug',
            component: './recommendation/analysis/debug'
          },
          {
            name: '用户数据',
            path: '/recommendation/analysis/userData',
            component: './recommendation/analysis/userData'
          },
          {
            name: '用户画像分析',
            path: '/recommendation/analysis/userPortrait',
            component: './recommendation/analysis/userPortrait'
          },
          {
            name: 'Post数据分析',
            path: '/recommendation/analysis/itemData',
            component: './recommendation/analysis/itemData'
          },
          {
            name: 'UID分析',
            path: '/recommendation/analysis/uidAnalysis',
            component: './recommendation/analysis/uidAnalysis'
          },
          {
            name: '标签评估系统',
            path: '/recommendation/analysis/tagEvaluation',
            component: './recommendation/analysis/tagEvaluation'
          },
          {
            name: 'Post行为数据',
            path: '/recommendation/analysis/postBehavior',
            component: './recommendation/analysis/postBehavior'
          }
        ]
      },
      {
        name: '管理平台',
        path: '/recommendation/management',
        routes: [
          {
            name: '推荐内容池管理',
            path: '/recommendation/management/tagging',
            component: './recommendation/management/tagging'
          },
          {
            name: '模型管理',
            path: '/recommendation/management/triton',
            component: './recommendation/management/triton'
          }
        ]
      }
    ]
  },
  {
    path: '/im',
    name: 'IM后台',
    routes: [
      {
        name: 'Dashboard',
        path: '/im/dashboard',
        component: './im/dashboard'
      },
      {
        name: 'Chat Monitoring',
        path: '/im/chatMonitoring',
        component: './im/chatMonitoring'
      },
      {
        name: '群组管理',
        path: '/im/groupManagement',
        component: './im/groupManagement'
      },
      {
        name: 'Big Win 红包雨统计',
        path: '/im/bigWinLuckCoinStats',
        component: './im/bigWinLuckCoinStats'
      }
    ]
  },
  {
    path: '/customerService',
    name: '客服系统',
    routes: [
      {
        name: '客服工作台',
        path: '/customerService/workbench',
        component: './customerService/workbench'
      },
      {
        name: '员工数据看板',
        path: '/customerService/employeeStats',
        component: './customerService/employeeStats'
      },
      {
        name: 'AI客服数据看板',
        path: '/customerService/aiStats',
        component: './customerService/aiStats'
      },
      {
        name: 'UPI管理',
        path: '/customerService/upi',
        component: './customerService/upi'
      }
    ]
  }
];

export default routes;
