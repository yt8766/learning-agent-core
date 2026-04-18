import { describe, expect, it } from 'vitest';

import * as templateExports from '../src';
import * as canonicalScaffoldTemplateRegistry from '../src/registries/scaffold-template-registry';
import * as canonicalTemplateRegistry from '../src/registries/frontend-template-registry';

describe('@agent/templates root exports', () => {
  it('re-exports the frontend template registry explicitly from the package root', () => {
    expect(templateExports.getFrontendTemplate).toBe(canonicalTemplateRegistry.getFrontendTemplate);
    expect(templateExports.listFrontendTemplates).toBe(canonicalTemplateRegistry.listFrontendTemplates);
    expect(templateExports.resolveFrontendTemplateDir).toBe(canonicalTemplateRegistry.resolveFrontendTemplateDir);
  });

  it('re-exports the scaffold template registry explicitly from the package root', () => {
    expect(templateExports.getScaffoldTemplate).toBe(canonicalScaffoldTemplateRegistry.getScaffoldTemplate);
    expect(templateExports.listScaffoldTemplates).toBe(canonicalScaffoldTemplateRegistry.listScaffoldTemplates);
    expect(templateExports.resolveScaffoldTemplateDir).toBe(
      canonicalScaffoldTemplateRegistry.resolveScaffoldTemplateDir
    );
  });
});
