import {
  getFrontendTemplate,
  getScaffoldTemplate,
  listFrontendTemplates,
  listScaffoldTemplates,
  resolveFrontendTemplateDir,
  resolveScaffoldTemplateDir
} from '../src/index.js';

const frontendTemplates = listFrontendTemplates();
const scaffoldTemplates = listScaffoldTemplates();
const frontendTemplate = getFrontendTemplate('react-ts');
const scaffoldTemplate = getScaffoldTemplate('package-lib');

console.log(
  JSON.stringify(
    {
      frontendTemplateCount: frontendTemplates.length,
      scaffoldTemplateCount: scaffoldTemplates.length,
      frontendEntryFiles: frontendTemplate?.entryFiles.slice(0, 4),
      scaffoldEntryFiles: scaffoldTemplate?.entryFiles.slice(0, 4),
      frontendTemplateDir: resolveFrontendTemplateDir('react-ts'),
      scaffoldTemplateDir: resolveScaffoldTemplateDir('package-lib')
    },
    null,
    2
  )
);
