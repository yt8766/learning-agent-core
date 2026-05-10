import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthFilesManagerPage } from '../src/app/pages/AuthFilesManagerPage';
import { OAuthPolicyPage } from '../src/app/pages/OAuthPolicyPage';
import { ProviderConfigPage } from '../src/app/pages/ProviderConfigPage';

describe('Agent Gateway provider and auth management pages', () => {
  it('renders provider config surfaces for compatible discovery and Ampcode mappings', () => {
    const html = renderToStaticMarkup(
      <ProviderConfigPage
        onRefreshModels={() => undefined}
        onSaveProvider={() => undefined}
        onTestModel={() => undefined}
      />
    );

    expect(html).toContain('Provider Config');
    expect(html).toContain('Gemini');
    expect(html).toContain('Codex');
    expect(html).toContain('Claude');
    expect(html).toContain('Vertex');
    expect(html).toContain('OpenAI-compatible');
    expect(html).toContain('Ampcode');
    expect(html).toContain('Model discovery');
    expect(html).toContain('Test model');
    expect(html).toContain('Upstream key mappings');
    expect(html).toContain('Model mappings');
    expect(html).toContain('Force mappings');
  });

  it('renders auth file manager controls for batch operations and list modes', () => {
    const html = renderToStaticMarkup(
      <AuthFilesManagerPage
        onBatchDelete={() => undefined}
        onBatchDownload={() => undefined}
        onBatchUpload={() => undefined}
        onListModels={() => undefined}
        onPatchFields={() => undefined}
        onToggleStatus={() => undefined}
      />
    );

    expect(html).toContain('Auth Files Manager');
    expect(html).toContain('Batch upload');
    expect(html).toContain('Batch download');
    expect(html).toContain('Batch delete');
    expect(html).toContain('Status toggle');
    expect(html).toContain('Field patch');
    expect(html).toContain('Model listing');
    expect(html).toContain('Filter');
    expect(html).toContain('Search');
    expect(html).toContain('Pagination');
    expect(html).toContain('Compact');
    expect(html).toContain('List diagram');
  });

  it('renders OAuth policy operations for models, aliases, polling, and Vertex import', () => {
    const html = renderToStaticMarkup(
      <OAuthPolicyPage
        onAddExcludedModel={() => undefined}
        onCreateAlias={() => undefined}
        onForkAlias={() => undefined}
        onImportVertexPolicy={() => undefined}
        onRefreshStatus={() => undefined}
        onStartCallbackPolling={() => undefined}
      />
    );

    expect(html).toContain('OAuth Policy');
    expect(html).toContain('Excluded models');
    expect(html).toContain('Model aliases');
    expect(html).toContain('Fork alias');
    expect(html).toContain('Callback polling');
    expect(html).toContain('Status polling');
    expect(html).toContain('Vertex import');
  });
});
