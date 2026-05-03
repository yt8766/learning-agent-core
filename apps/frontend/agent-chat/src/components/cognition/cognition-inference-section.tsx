import type { ReactNode } from 'react';

export interface CognitionInferenceSectionProps {
  title?: string;
  loading?: boolean;
  children?: ReactNode;
}

export function CognitionInferenceSection({ title, loading, children }: CognitionInferenceSectionProps) {
  return (
    <section className={`chatx-cognition-inference ${loading ? 'is-loading' : 'is-complete'}`}>
      {title ? (
        <header className="chatx-cognition-inference__header">
          {loading ? (
            <span className="chatx-cognition-inference__loader" aria-hidden="true">
              <span className="chatx-cognition-inference__bar" />
              <span className="chatx-cognition-inference__bar" />
              <span className="chatx-cognition-inference__bar" />
            </span>
          ) : null}
          <span className="chatx-cognition-inference__title">{title}</span>
        </header>
      ) : null}
      {children ? <div className="chatx-cognition-inference__body">{children}</div> : null}
    </section>
  );
}
