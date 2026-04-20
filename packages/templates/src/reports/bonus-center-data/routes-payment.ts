export const paymentRoutes = [
  {
    path: '/payment',
    name: '付款工单',
    routes: [
      {
        name: '工单列表',
        path: '/payment/workOrder',
        component: './payment/workOrder'
      },
      {
        name: '审批流配置',
        path: '/payment/approvalFlow',
        component: './payment/approvalFlow'
      },
      {
        name: '工单付款统计',
        path: '/payment/statistics',
        component: './payment/statistics'
      }
    ]
  },
  {
    path: '/paymentReport',
    name: '支付管理与报表功能',
    routes: [
      {
        name: '充值报表',
        path: '/paymentReport/rechargeReport',
        routes: [
          {
            name: '财务对账报表',
            path: '/paymentReport/rechargeReport/financeReconciliation',
            component: './paymentReport/rechargeReport/financeReconciliation'
          },
          {
            name: '渠道质量与漏斗分析看板',
            path: '/paymentReport/rechargeReport/channelFunnelAnalysis',
            component: './dataDashboard/payment/channelFunnelAnalysis'
          }
        ]
      }
    ]
  }
];
