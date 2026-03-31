export function extractPromptResultRows(raw) {
  const candidates = [raw?.results, raw?.evaluations, raw?.outputs, raw?.rows].find(Array.isArray) ?? [];
  return candidates
    .map(item => {
      const promptId = item?.prompt?.id ?? item?.promptId ?? item?.prompt?.rawId ?? item?.prompt?.label ?? item?.id;
      const providerId = item?.provider?.id ?? item?.providerId ?? item?.provider ?? item?.providerLabel;
      const explicitPass =
        typeof item?.success === 'boolean'
          ? item.success
          : typeof item?.pass === 'boolean'
            ? item.pass
            : typeof item?.gradingResult?.pass === 'boolean'
              ? item.gradingResult.pass
              : typeof item?.score === 'number'
                ? item.score > 0
                : undefined;

      if (!promptId) {
        return undefined;
      }

      return {
        promptId: String(promptId),
        providerId: providerId ? String(providerId) : undefined,
        pass: explicitPass,
        score: typeof item?.score === 'number' ? item.score : undefined,
        namedScores: item?.namedScores
      };
    })
    .filter(Boolean);
}

export function derivePromptRegressionSummary(raw, options = {}) {
  const rows = extractPromptResultRows(raw);
  const providerIds = Array.from(new Set(rows.map(row => row.providerId).filter(Boolean))).sort();
  const suites = new Map();
  let passCount = 0;

  for (const row of rows) {
    const suiteId = row.promptId.replace(/-v\d+$/, '');
    const versionMatch = row.promptId.match(/-(v\d+)$/);
    const version = versionMatch?.[1] ?? row.promptId;
    const suite = suites.get(suiteId) ?? {
      suiteId,
      label: suiteId,
      rowCount: 0,
      passCount: 0,
      notes: [],
      promptResults: []
    };
    suite.rowCount += 1;
    if (row.pass === true) {
      suite.passCount += 1;
      passCount += 1;
    }
    if (versionMatch?.[1] && !suite.notes.includes(versionMatch[1])) {
      suite.notes.push(versionMatch[1]);
    }
    suite.promptResults.push({
      promptId: row.promptId,
      version,
      providerId: row.providerId,
      pass: row.pass,
      score: row.score
    });
    suites.set(suiteId, suite);
  }

  const suiteResults = Array.from(suites.values())
    .map(suite => {
      const passRate = suite.rowCount === 0 ? undefined : Math.round((suite.passCount / suite.rowCount) * 100);
      const status =
        suite.rowCount === 0
          ? 'partial'
          : suite.passCount === suite.rowCount
            ? 'pass'
            : suite.passCount === 0
              ? 'fail'
              : 'partial';
      return {
        suiteId: suite.suiteId,
        label: suite.label,
        status,
        passRate,
        notes: buildSuiteNotes(suite),
        promptResults: suite.promptResults.slice().sort((left, right) => left.promptId.localeCompare(right.promptId))
      };
    })
    .sort((left, right) => left.suiteId.localeCompare(right.suiteId));

  const totalRows = rows.length;
  const passRate = totalRows === 0 ? undefined : Math.round((passCount / totalRows) * 100);
  const overallStatus =
    totalRows === 0 ? 'partial' : passCount === totalRows ? 'pass' : passCount === 0 ? 'fail' : 'partial';

  return {
    runAt: options.runAt ?? new Date().toISOString(),
    overallStatus,
    passRate,
    providerIds,
    suiteResults
  };
}

export function enforcePromptRegressionGate(summary, options = {}) {
  const threshold = options.threshold ?? 90;
  const coreSuites = options.coreSuites ?? [
    'supervisor-plan',
    'specialist-finding',
    'hubu-research',
    'xingbu-review',
    'libu-delivery'
  ];

  const indexedSuites = new Map((summary?.suiteResults ?? []).map(item => [item.suiteId, item]));
  const failures = [];

  for (const suiteId of coreSuites) {
    const suite = indexedSuites.get(suiteId);
    if (!suite) {
      failures.push(`${suiteId}: missing`);
      continue;
    }

    if (typeof suite.passRate !== 'number' || suite.passRate <= threshold) {
      failures.push(`${suiteId}: ${suite.passRate ?? 'n/a'}%`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      [
        `Prompt regression gate failed. Core suites must stay above ${threshold}%.`,
        `Failures: ${failures.join(', ')}`
      ].join(' ')
    );
  }

  return {
    threshold,
    coreSuites
  };
}

function buildSuiteNotes(suite) {
  const notes = [];
  if (suite.notes.length) {
    notes.push(`versions: ${suite.notes.sort().join(', ')}`);
  }

  const best = suite.promptResults.filter(item => item.pass === true).map(item => item.version);
  const worst = suite.promptResults.filter(item => item.pass === false).map(item => item.version);
  if (best.length) {
    notes.push(`pass: ${Array.from(new Set(best)).join(', ')}`);
  }
  if (worst.length) {
    notes.push(`fail: ${Array.from(new Set(worst)).join(', ')}`);
  }

  return notes.length ? notes : undefined;
}
