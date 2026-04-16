import { describe, expect, it } from 'vitest';

import * as templateExports from '../src';
import * as scaffoldTemplateRegistry from '../src/scaffold-template-registry';
import * as templateRegistry from '../src/template-registry';

describe('@agent/templates root exports', () => {
  it('re-exports the frontend template registry explicitly', () => {
    expect(templateExports.getFrontendTemplate).toBe(templateRegistry.getFrontendTemplate);
    expect(templateExports.listFrontendTemplates).toBe(templateRegistry.listFrontendTemplates);
    expect(templateExports.resolveFrontendTemplateDir).toBe(templateRegistry.resolveFrontendTemplateDir);
  });

  it('re-exports the scaffold template registry explicitly', () => {
    expect(templateExports.getScaffoldTemplate).toBe(scaffoldTemplateRegistry.getScaffoldTemplate);
    expect(templateExports.listScaffoldTemplates).toBe(scaffoldTemplateRegistry.listScaffoldTemplates);
    expect(templateExports.resolveScaffoldTemplateDir).toBe(scaffoldTemplateRegistry.resolveScaffoldTemplateDir);
  });
});
