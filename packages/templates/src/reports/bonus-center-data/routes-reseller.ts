export const resellerRoutes = [
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
];
