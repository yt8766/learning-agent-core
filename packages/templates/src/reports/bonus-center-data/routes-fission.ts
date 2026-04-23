export const fissionRoutes = [
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
  }
];
