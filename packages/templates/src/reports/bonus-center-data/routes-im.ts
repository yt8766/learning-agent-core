export const imRoutes = [
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
