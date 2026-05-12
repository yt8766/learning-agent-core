import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CognitionInferenceSection } from '@/components/cognition/cognition-inference-section';

describe('CognitionInferenceSection', () => {
  it('renders with loading state and title', () => {
    const html = renderToStaticMarkup(
      <CognitionInferenceSection title="Thinking" loading>
        <p>Child content</p>
      </CognitionInferenceSection>
    );

    expect(html).toContain('is-loading');
    expect(html).toContain('Thinking');
    expect(html).toContain('Child content');
    expect(html).toContain('chatx-cognition-inference__loader');
  });

  it('renders with complete state', () => {
    const html = renderToStaticMarkup(
      <CognitionInferenceSection title="Done" loading={false}>
        <p>Result</p>
      </CognitionInferenceSection>
    );

    expect(html).toContain('is-complete');
    expect(html).toContain('Done');
    expect(html).toContain('Result');
    expect(html).not.toContain('chatx-cognition-inference__loader');
  });

  it('renders without title', () => {
    const html = renderToStaticMarkup(
      <CognitionInferenceSection>
        <p>Content only</p>
      </CognitionInferenceSection>
    );

    expect(html).toContain('Content only');
    expect(html).not.toContain('chatx-cognition-inference__header');
  });

  it('renders without children', () => {
    const html = renderToStaticMarkup(<CognitionInferenceSection title="Title only" />);

    expect(html).toContain('Title only');
    expect(html).not.toContain('chatx-cognition-inference__body');
  });

  it('defaults to complete state when loading is not provided', () => {
    const html = renderToStaticMarkup(
      <CognitionInferenceSection title="Default">
        <p>Content</p>
      </CognitionInferenceSection>
    );

    expect(html).toContain('is-complete');
    expect(html).not.toContain('is-loading');
  });
});
