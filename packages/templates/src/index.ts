export type { FrontendTemplateDefinition, ScaffoldTemplateDefinition } from './contracts/template-definitions';
import {
  getFrontendTemplate as getRegisteredFrontendTemplate,
  listFrontendTemplates as listRegisteredFrontendTemplates,
  resolveFrontendTemplateDir as resolveRegisteredFrontendTemplateDir
} from './registries/frontend-template-registry';

import type { FrontendTemplateDefinition } from './contracts/template-definitions';

function isPublicFrontendTemplate(template: FrontendTemplateDefinition): boolean {
  return !template.directoryName.startsWith('reports/');
}

export function listFrontendTemplates(): FrontendTemplateDefinition[] {
  return listRegisteredFrontendTemplates().filter(isPublicFrontendTemplate);
}

export function getFrontendTemplate(templateId: string): FrontendTemplateDefinition | undefined {
  const template = getRegisteredFrontendTemplate(templateId);
  return template && isPublicFrontendTemplate(template) ? template : undefined;
}

export function resolveFrontendTemplateDir(templateId: string): string | undefined {
  return getFrontendTemplate(templateId) ? resolveRegisteredFrontendTemplateDir(templateId) : undefined;
}

export {
  getScaffoldTemplate,
  listScaffoldTemplates,
  resolveScaffoldTemplateDir
} from './registries/scaffold-template-registry';
