import { DigestGraphStateSchema, type DigestGraphState } from '../schemas/digest-graph-state.schema';

type RenderDigestContentNodeInput = Pick<DigestGraphState, 'digestDate' | 'groupedSignals' | 'highlights'> &
  Partial<DigestGraphState>;

function formatEvidenceLabel(sourceCount: number): string {
  return sourceCount === 1 ? 'source' : 'sources';
}

export function renderDigestContentNode(input: RenderDigestContentNodeInput): DigestGraphState {
  const title = `Intel Daily Digest - ${input.digestDate}`;
  const highlightLines =
    input.highlights.length === 0
      ? ['No same-day signals were collected.']
      : input.highlights.flatMap(highlight => {
          const evidence = input.signalEvidence?.[highlight.signal.id];
          const evidenceLines =
            evidence === undefined
              ? ['   Evidence: no linked sources yet']
              : [
                  `   Evidence: ${evidence.sourceCount} ${formatEvidenceLabel(evidence.sourceCount)} (${evidence.officialSourceCount} official / ${evidence.communitySourceCount} community)`,
                  ...evidence.references.map(
                    reference => `   - ${reference.sourceName} (${reference.sourceType}): ${reference.url}`
                  )
                ];

          return [
            `${highlight.rank}. [${highlight.signal.priority}] ${highlight.signal.title} (${highlight.signal.category})`,
            ...evidenceLines
          ];
        });
  const groupLines =
    input.groupedSignals.length === 0
      ? ['- none']
      : input.groupedSignals.map(
          group => `- ${group.category} (${group.signalCount}): ${group.highlightSignalIds.join(', ')}`
        );

  const markdown = [title, '', '## Highlights', ...highlightLines, '', '## Groups', ...groupLines].join('\n');

  return DigestGraphStateSchema.parse({
    ...input,
    renderedDigest: {
      title,
      markdown
    }
  });
}
