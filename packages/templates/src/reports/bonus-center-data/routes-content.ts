export const contentRoutes = [
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
];
