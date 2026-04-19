export const baseRoutes = [
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
    path: '/json',
    component: './json',
    title: 'json页面'
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
];
