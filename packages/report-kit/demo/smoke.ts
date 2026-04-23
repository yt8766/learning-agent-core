import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadLocalModule, printDemoResult, summarizeModuleExports } from '../../../scripts/demo-smoke.js';

const demoDir = dirname(fileURLToPath(import.meta.url));
const publicApi = loadLocalModule(demoDir, '../build/cjs/index.js');

printDemoResult(summarizeModuleExports('@agent/report-kit', publicApi));
