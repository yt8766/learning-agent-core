export const aiRoutes = [
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
];
