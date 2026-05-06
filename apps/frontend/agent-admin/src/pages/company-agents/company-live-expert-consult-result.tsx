import { Badge } from '@/components/ui/badge';

import type { CompanyExpertConsultation } from '@agent/core';

interface CompanyLiveExpertConsultResultProps {
  result: CompanyExpertConsultation;
}

function EmptyLine({ label }: { label: string }) {
  return <p className="min-w-0 break-words text-xs text-muted-foreground">{label}：暂无</p>;
}

const badgeWrapClassName = 'min-w-0 max-w-full';
const badgeTextClassName = 'max-w-full whitespace-normal break-words';

export function CompanyLiveExpertConsultResult({ result }: CompanyLiveExpertConsultResultProps) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-card/90 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 break-words">
          <p className="min-w-0 break-words text-sm font-semibold text-foreground">专家会诊结果</p>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">{result.userQuestion}</p>
        </div>
        <Badge className={`${badgeTextClassName} break-all`} title={result.consultationId} variant="outline">
          {result.consultationId}
        </Badge>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        {result.selectedExperts.map(expertId => (
          <span key={expertId} className={badgeWrapClassName}>
            <Badge className={badgeTextClassName} variant="secondary">
              {expertId}
            </Badge>
          </span>
        ))}
      </div>

      <div className="mt-4 grid min-w-0 gap-3">
        <section className="grid min-w-0 gap-2">
          <p className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Expert Findings
          </p>
          {result.expertFindings.map(finding => (
            <div key={finding.expertId} className="min-w-0 rounded-md border border-border/50 bg-muted/20 px-3 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge className={badgeTextClassName} variant="outline">
                  {finding.role}
                </Badge>
                <span className="min-w-0 break-words text-sm font-medium text-foreground">{finding.summary}</span>
                <span className="min-w-0 break-words text-xs text-muted-foreground">
                  {Math.round(finding.confidence * 100)}%
                </span>
              </div>
              {finding.diagnosis.length ? (
                <ul className="mt-2 min-w-0 list-disc space-y-1 break-words pl-4 text-sm text-muted-foreground">
                  {finding.diagnosis.map(item => (
                    <li key={`${finding.expertId}-diagnosis-${item}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {finding.recommendations.length ? (
                <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                  {finding.recommendations.map(item => (
                    <span key={`${finding.expertId}-recommendation-${item}`} className={badgeWrapClassName}>
                      <Badge className={badgeTextClassName} variant="secondary">
                        {item}
                      </Badge>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <section className="grid min-w-0 gap-2">
          <p className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Missing Inputs
          </p>
          {result.missingInputs.length ? (
            <ul className="min-w-0 list-disc space-y-1 break-words pl-4 text-sm text-muted-foreground">
              {result.missingInputs.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <EmptyLine label="缺失输入" />
          )}
        </section>

        <section className="grid min-w-0 gap-2">
          <p className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Conflicts
          </p>
          {result.conflicts.length ? (
            <div className="grid min-w-0 gap-2">
              {result.conflicts.map(conflict => (
                <div
                  key={conflict.conflictId}
                  className="min-w-0 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <p className="min-w-0 break-words text-sm font-medium text-foreground">{conflict.summary}</p>
                  <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">{conflict.resolutionHint}</p>
                  <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                    {conflict.expertIds.map(expertId => (
                      <span key={`${conflict.conflictId}-${expertId}`} className={badgeWrapClassName}>
                        <Badge className={badgeTextClassName} variant="outline">
                          {expertId}
                        </Badge>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine label="冲突" />
          )}
        </section>

        <section className="grid min-w-0 gap-2">
          <p className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next Actions
          </p>
          {result.nextActions.length ? (
            <div className="grid min-w-0 gap-2">
              {result.nextActions.map(action => (
                <div
                  key={action.actionId}
                  className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <Badge className={badgeTextClassName} variant={action.priority === 'high' ? 'warning' : 'outline'}>
                    {action.priority}
                  </Badge>
                  <span className="min-w-0 break-words text-sm text-foreground">{action.label}</span>
                  <span className="min-w-0 break-words text-xs text-muted-foreground">{action.ownerExpertId}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine label="下一步" />
          )}
        </section>
      </div>
    </div>
  );
}
