export type { FrontendTemplateDefinition, ScaffoldTemplateDefinition } from './contracts/template-definitions';
export {
  getFrontendTemplate,
  listFrontendTemplates,
  resolveFrontendTemplateDir
} from './registries/frontend-template-registry';
export {
  getScaffoldTemplate,
  listScaffoldTemplates,
  resolveScaffoldTemplateDir
} from './registries/scaffold-template-registry';
