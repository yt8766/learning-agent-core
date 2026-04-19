export const feedbackRoutes = [
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
];
