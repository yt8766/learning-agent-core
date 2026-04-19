export const userRoutes = [
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
];
