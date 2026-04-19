// @ts-nocheck
import { MenuDataItem } from '@ant-design/pro-components';

import { baseRoutes } from './routes-base';
import { systemRoutes } from './routes-system';
import { paymentRoutes } from './routes-payment';
import { userRoutes } from './routes-user';
import { liveRoutes } from './routes-live';
import { feedbackRoutes } from './routes-feedback';
import { configCoreRoutes } from './routes-config-core';
import { configFeaturesRoutes } from './routes-config-features';
import { toolRoutes } from './routes-tool';
import { auditRoutes } from './routes-audit';
import { resellerRoutes } from './routes-reseller';
import { dashboardAnalyticsRoutes } from './routes-data-dashboard-analytics';
import { dashboardOperationsRoutes } from './routes-data-dashboard-operations';
import { contentRoutes } from './routes-content';
import { fissionRoutes } from './routes-fission';
import { aiRoutes } from './routes-ai';
import { imRoutes } from './routes-im';

// import locales from './locales';

const routes: MenuDataItem = [
  ...baseRoutes,
  ...systemRoutes,
  ...paymentRoutes,
  ...userRoutes,
  ...liveRoutes,
  ...feedbackRoutes,
  {
    name: '配置项',
    path: '/config',
    routes: [...configCoreRoutes, ...configFeaturesRoutes],
  },
  ...toolRoutes,
  ...auditRoutes,
  ...resellerRoutes,
  {
    path: '/dataDashboard',
    name: '数据看板',
    routes: [...dashboardAnalyticsRoutes, ...dashboardOperationsRoutes],
  },
  ...contentRoutes,
  ...fissionRoutes,
  ...aiRoutes,
  ...imRoutes,
];

export default routes;
