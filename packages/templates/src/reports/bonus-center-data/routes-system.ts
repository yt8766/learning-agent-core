export const systemRoutes = [
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
];
