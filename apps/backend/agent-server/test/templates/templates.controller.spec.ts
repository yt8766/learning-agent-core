import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { TemplatesController } from '../../src/templates/templates.controller';
import { TemplatesService } from '../../src/templates/templates.service';

describe('TemplatesController', () => {
  let controller: TemplatesController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [TemplatesService]
    }).compile();

    controller = moduleRef.get<TemplatesController>(TemplatesController);
  });

  it('returns the react-ts template files in sandpack format', async () => {
    const payload = controller.getReactTsTemplate();

    await expect(payload).resolves.toMatchObject({
      '/App.tsx': { code: expect.stringContaining('export default function App()') },
      '/index.tsx': { code: expect.stringContaining('createRoot') },
      '/styles.css': { code: expect.any(String) },
      '/package.json': {
        code: expect.stringContaining('"name": "react-project"')
      }
    });
  });

  it('removes ts-nocheck directives from returned template files', async () => {
    const payload = await controller.getReactTsTemplate();

    expect(payload['/App.tsx']?.code).not.toContain('// @ts-nocheck');
    expect(payload['/index.tsx']?.code).not.toContain('// @ts-nocheck');
  });

  it('returns a sandpack-friendly react-ts package manifest', async () => {
    const payload = await controller.getReactTsTemplate();
    const packageJson = JSON.parse(payload['/package.json']?.code ?? '{}') as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(packageJson.name).toBe('react-project');
    expect(packageJson.scripts).toMatchObject({
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    });
    expect(packageJson.dependencies).toMatchObject({
      react: expect.any(String),
      'react-dom': expect.any(String),
      'lucide-react': expect.any(String)
    });
    expect(packageJson.dependencies).not.toHaveProperty('@umijs/max');
  });

  it('returns arbitrary template files by template id', async () => {
    const payload = controller.getTemplateById('bonus-center-data');

    await expect(payload).resolves.toMatchObject({
      '/routes.ts': { code: expect.any(String) },
      '/pages/dataDashboard/bonusCenterData/index.tsx': { code: expect.any(String) },
      '/pages/dataDashboard/bonusCenterData/config.tsx': { code: expect.any(String) }
    });
  });
});
