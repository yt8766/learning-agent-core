export const auditRoutes = [
  {
    path: '/audit',
    name: '审查后台',
    routes: [
      {
        name: '动态审核',
        path: '/audit/moment',
        component: './audit/Moment'
      },
      {
        name: 'UGC用户审核',
        path: '/audit/ugcUserAudit',
        component: './audit/ugcUserAudit'
      },
      {
        name: '敏感词',
        path: '/audit/sensitive',
        component: './audit/sensitive'
      },
      {
        name: '直播审核',
        path: '/audit/liveReview',
        component: './audit/liveReview'
      },
      {
        name: '封禁管理',
        path: '/audit/ban',
        component: './audit/ban'
      },
      {
        name: '申请解除封禁列表',
        path: '/audit/banApply',
        component: './audit/banApply'
      },
      {
        name: '举报管理',
        path: '/audit/report',
        component: './audit/report'
      },
      {
        name: '举报管理（汇总）',
        path: '/audit/reportSummary',
        component: './audit/reportSummary'
      },
      {
        name: '个人信息审核',
        path: '/audit/userAudit',
        component: './audit/userAudit'
      },
      {
        name: '主播资料审核',
        path: '/audit/anchorAudit',
        component: './audit/anchorAudit'
      },
      {
        name: '优质主播',
        path: '/audit/superiorAnchor',
        component: './audit/superiorAnchor'
      },
      {
        name: '警告记录',
        path: '/audit/warning',
        component: './audit/warning'
      },
      {
        name: '主播踢出/禁言记录',
        path: '/audit/kick',
        component: './audit/kick'
      },
      {
        name: 'KYC审核',
        path: '/audit/kycAudit',
        component: './audit/kycAudit'
      },
      {
        name: 'Post审核',
        path: '/audit/postReview',
        routes: [
          {
            name: '审核详情',
            path: '/audit/postReview/overview',
            component: './audit/postReview/overview'
          },
          {
            name: '审核操作',
            path: '/audit/postReview/operate',
            component: './audit/postReview/operate',
            hideInMenu: true
          },
          {
            name: '审核记录',
            path: '/audit/postReview/history',
            component: './audit/postReview/history'
          },
          {
            name: '审核数据',
            path: '/audit/postReview/dashboard',
            component: './audit/postReview/dashboard'
          },
          {
            name: '审核员详情',
            path: '/audit/postReview/auditorDetail',
            component: './audit/postReview/auditorDetail',
            hideInMenu: true
          },
          {
            name: '质检记录',
            path: '/audit/postReview/qualityRecord',
            component: './audit/postReview/qualityRecord'
          },
          {
            name: '质检操作',
            path: '/audit/postReview/qualityOperate',
            component: './audit/postReview/qualityOperate',
            hideInMenu: true
          },
          {
            name: '质量评级',
            path: '/audit/postReview/qualityGrade',
            component: './audit/postReview/qualityGrade',
            hideInMenu: true
          }
          // {
          //   name: '质检历史',
          //   path: '/audit/postReview/qualityHistory',
          //   component: './audit/postReview/qualityHistory',
          //   hideInMenu: true,
          // },
        ]
      },
      {
        name: 'Post搜索',
        path: '/audit/postSearch',
        component: './audit/postSearch'
      },
      {
        name: 'Post详情',
        path: '/audit/postSearch/detail/:id',
        component: './audit/postSearch/detail',
        hideInMenu: true
      }
    ]
  }
];
