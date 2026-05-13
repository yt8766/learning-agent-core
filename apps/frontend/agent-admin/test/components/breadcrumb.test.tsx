import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';

describe('Breadcrumb', () => {
  it('renders nav with aria-label', () => {
    const html = renderToStaticMarkup(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('Home');
  });

  it('renders BreadcrumbList as ol', () => {
    const html = renderToStaticMarkup(
      <BreadcrumbList>
        <BreadcrumbItem>Item</BreadcrumbItem>
      </BreadcrumbList>
    );

    expect(html).toContain('<ol');
    expect(html).toContain('Item');
  });

  it('renders BreadcrumbItem as li', () => {
    const html = renderToStaticMarkup(<BreadcrumbItem>Content</BreadcrumbItem>);

    expect(html).toContain('<li');
    expect(html).toContain('Content');
  });

  it('renders BreadcrumbLink as anchor', () => {
    const html = renderToStaticMarkup(<BreadcrumbLink href="/page">Link</BreadcrumbLink>);

    expect(html).toContain('<a');
    expect(html).toContain('href="/page"');
    expect(html).toContain('Link');
  });

  it('renders BreadcrumbPage with aria-current', () => {
    const html = renderToStaticMarkup(<BreadcrumbPage>Current Page</BreadcrumbPage>);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Current Page');
  });

  it('renders BreadcrumbSeparator with default chevron', () => {
    const html = renderToStaticMarkup(<BreadcrumbSeparator />);

    expect(html).toContain('aria-hidden="true"');
  });

  it('renders BreadcrumbSeparator with custom children', () => {
    const html = renderToStaticMarkup(<BreadcrumbSeparator>/</BreadcrumbSeparator>);

    expect(html).toContain('/');
  });

  it('applies custom className', () => {
    const html = renderToStaticMarkup(<Breadcrumb className="custom-class">Nav</Breadcrumb>);

    expect(html).toContain('custom-class');
  });
});
