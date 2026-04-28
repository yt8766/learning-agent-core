export const toolRoutes = [
  {
    name: '开发者工具',
    path: '/tool',
    routes: [
      {
        name: '通用配置',
        path: '/tool/universal',
        component: './tool/universal'
      },
      {
        name: '上传文件',
        path: '/tool/upload',
        component: './tool/upload'
      },
      {
        name: '翻译后台',
        path: '/tool/translate',
        component: './tool/translate'
      },
      {
        name: '短链',
        path: '/tool/shortChain',
        component: './tool/shortChain'
      },
      {
        name: '短链',
        path: '/tool/custom',
        component: './tool/custom'
      },
      {
        name: 'pprof',
        path: '/tool/pprof',
        component: './tool/pprof'
      },
      {
        name: 'AI知识助手',
        path: '/tool/aiAssistant',
        component: './tool/aiAssistant'
      },
      {
        name: 'Post批量上传',
        path: '/tool/postBatchUpload',
        component: './tool/postBatchUpload'
      },
      {
        name: '图集上传',
        path: '/tool/atlasUpload',
        component: './tool/atlasUpload'
      },
      {
        name: '短剧上传',
        path: '/tool/dramaUpload',
        component: './tool/dramaUpload'
      },
      {
        name: '接口调用次数看板',
        path: '/tool/apiCallCount',
        component: './tool/ApiCallCount'
      }
    ]
  }
];
