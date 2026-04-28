import { describe, expect, it } from 'vitest';

import * as templateExports from '../src';
import * as canonicalScaffoldTemplateRegistry from '../src/registries/scaffold-template-registry';
import * as canonicalTemplateRegistry from '../src/registries/frontend-template-registry';

describe('@agent/templates root exports', () => {
  it('keeps public frontend template exports filtered to non-report templates', () => {
    expect(templateExports.getFrontendTemplate('react-ts')).toBe(
      canonicalTemplateRegistry.getFrontendTemplate('react-ts')
    );
    expect(templateExports.resolveFrontendTemplateDir('react-ts')).toBe(
      canonicalTemplateRegistry.resolveFrontendTemplateDir('react-ts')
    );
    expect(templateExports.getFrontendTemplate('bonus-center-data')).toBeUndefined();
    expect(templateExports.listFrontendTemplates()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ directoryName: expect.stringMatching(/^reports\//) })])
    );
  });

  it('re-exports the scaffold template registry explicitly from the package root', () => {
    expect(templateExports.getScaffoldTemplate).toBe(canonicalScaffoldTemplateRegistry.getScaffoldTemplate);
    expect(templateExports.listScaffoldTemplates).toBe(canonicalScaffoldTemplateRegistry.listScaffoldTemplates);
    expect(templateExports.resolveScaffoldTemplateDir).toBe(
      canonicalScaffoldTemplateRegistry.resolveScaffoldTemplateDir
    );
  });
});
