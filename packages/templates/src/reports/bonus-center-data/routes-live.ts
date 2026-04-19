export const liveRoutes = [
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
];
