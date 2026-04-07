// derive.ts — raw JSON shapes and derivation logic for the dashboard renderer.
// All types here mirror the serialised output of writeDashboardData() exactly.

// ─── Raw JSON shapes ──────────────────────────────────────────────────────────

export interface RawOverall {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  broken: number;
  unknown: number;
  passRate: number;
}

export interface RawSlice {
  dimension: string;
  value: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  broken: number;
  unknown: number;
  passRate: number;
}

export interface RawConnectorAggregation {
  overall: RawOverall;
  dimensions: Record<string, RawSlice[]>;
  category: 'testing' | 'coverage' | 'lint';
}

export interface RawSummary {
  generatedAt: string;
  projectName?: string;
  /** Absolute path of the project root — used to display relative file paths */
  projectRoot?: string;
  connectors: string[];
  overall: RawOverall;
  dimensions: Record<string, RawSlice[]>;
  history: Array<{
    runAt: string;
    connectors: string[];
    overall: RawOverall;
    dimensionSummary: Record<string, Record<string, { total: number; passed: number; failed: number }>>;
    testPassRate?: number;
    coveragePassRate?: number;
  }>;
  byConnector: Record<string, RawConnectorAggregation>;
  /**
   * Optional: package type map contributed by plugins via ScanPlugin.packageType().
   * Written to summary.json by the dashboard command when plugins declare a type.
   */
  packageTypes?: Record<string, string>;
}

export interface RawRecord {
  id: string;
  connectorId: string;
  runAt: string;
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'broken' | 'unknown';
  duration: number;
  dimensions: Record<string, string>;
  source: { file: string; connectorId: string };
  metadata?: Record<string, unknown>;
}

export interface RawFinding {
  ruleId: string;
  kind: string;
  severity: 'error' | 'warning' | 'info';
  subject: {
    type: 'file' | 'edge' | 'slice';
    path?: string;
    from?: string;
    to?: string;
    dimensions?: Record<string, string>;
  };
  dimensions: Record<string, string>;
  value?: number;
  message: string;
}

// ─── Derived shapes (used by view components) ─────────────────────────────────

export interface FindingsCount {
  error: number;
  warning: number;
  info: number;
}

export interface PackageInfo {
  name: string;
  /**
   * Package type key — matches one of the icons in the renderer's icon registry.
   * Populated from `ScanPlugin.packageType()` for the first applicable plugin.
   * Falls back to `'library'` when no plugin claims the package.
   * Known values: 'library' | 'webapp' | 'nextjs' | 'react' | 'electron' |
   *               'storybook' | 'playwright' | 'api' | 'cli' | 'database' |
   *               'drizzle' | 'prisma'
   */
  type: string;
  /** Total from testing connectors only (not lcov/eslint/typescript) */
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  broken: number;
  /** null when there are no test records for this package (coverage-only packages) */
  passRate: number | null;
  /** LCov passRate for this package (fraction of covered files) */
  coverage: number;
  findings: FindingsCount;
}

export interface TestInfo {
  id: string;
  name: string;
  fullName: string;
  status: RawRecord['status'];
  duration: number;
  connectorId: string;
  /** From metadata.failureMessages (Vitest) or metadata.error */
  errorMessage?: string;
  /** From metadata.bddSource — written by BDD-aware connectors */
  bddSource?: string;
}

export interface SuiteInfo {
  /** Filename stripped of .test.ts/.spec.tsx suffix */
  name: string;
  /** Absolute path from source.file */
  file: string;
  pkg: string;
  role: string;
  domain: string;
  layer: string;
  /** 0–1 from lcov if available, null otherwise */
  coverage: number | null;
  tests: TestInfo[];
}

// ─── Testing-only overall ─────────────────────────────────────────────────────
/** Aggregate pass/fail counts across testing-category connectors only (excludes lcov/eslint/typescript). */
export function deriveTestingOverall(summary: RawSummary): {
  passed: number; failed: number; broken: number; skipped: number; total: number; passRate: number;
} {
  const acc = { passed: 0, failed: 0, broken: 0, skipped: 0, total: 0 };
  for (const conn of Object.values(summary.byConnector)) {
    if (conn.category !== 'testing') continue;
    acc.passed  += conn.overall.passed;
    acc.failed  += conn.overall.failed;
    acc.broken  += conn.overall.broken;
    acc.skipped += conn.overall.skipped;
    acc.total   += conn.overall.total;
  }
  return { ...acc, passRate: acc.total > 0 ? acc.passed / acc.total : 1 };
}

// ─── Derivation ───────────────────────────────────────────────────────────────

const TESTING_CATEGORIES = new Set<RawConnectorAggregation['category']>(['testing']);

function extractError(r: RawRecord): string | undefined {
  const msgs = r.metadata?.['failureMessages'];
  if (Array.isArray(msgs) && msgs.length > 0) {
    return (msgs as unknown[]).filter(Boolean).map(String).join('\n');
  }
  const err = r.metadata?.['error'];
  if (typeof err === 'string' && err.length > 0) return err;
  return undefined;
}

function extractBdd(r: RawRecord): string | undefined {
  const src = r.metadata?.['bddSource'];
  return typeof src === 'string' && src.length > 0 ? src : undefined;
}

function suiteName(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath;
  // Strip common test suffixes
  return base
    .replace(/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/, '')
    .replace(/\.(test|spec)$/, '');
}

/**
 * Derive per-package info from summary + findings.
 * Testing pass rate comes from testing-category connectors only.
 * Coverage comes from the lcov connector's package dimension.
 */
export function derivePackages(summary: RawSummary, findings: RawFinding[]): PackageInfo[] {
  // Aggregate testing totals per package across all testing connectors
  const testing = new Map<string, { passed: number; failed: number; skipped: number; broken: number; total: number }>();

  for (const [connId, conn] of Object.entries(summary.byConnector)) {
    if (!TESTING_CATEGORIES.has(conn.category)) continue;
    for (const slice of conn.dimensions['package'] ?? []) {
      const prev = testing.get(slice.value) ?? { passed: 0, failed: 0, skipped: 0, broken: 0, total: 0 };
      testing.set(slice.value, {
        passed:  prev.passed  + slice.passed,
        failed:  prev.failed  + slice.failed,
        skipped: prev.skipped + slice.skipped,
        broken:  prev.broken  + slice.broken,
        total:   prev.total   + slice.total,
      });
    }
  }

  // Coverage per package from lcov connector
  const coverageByPkg = new Map<string, number>(
    (summary.byConnector['lcov']?.dimensions?.['package'] ?? []).map(s => [s.value, s.passRate])
  );

  // Findings per package
  const findingsByPkg = new Map<string, FindingsCount>();
  for (const f of findings) {
    const pkg = f.dimensions['package'];
    if (!pkg) continue;
    const prev = findingsByPkg.get(pkg) ?? { error: 0, warning: 0, info: 0 };
    prev[f.severity]++;
    findingsByPkg.set(pkg, prev);
  }

  // Union of all known package names
  const allNames = new Set([...testing.keys(), ...coverageByPkg.keys()]);

  // Package type: prefer plugin-declared (summary.packageTypes), then heuristic.
  // Heuristic: which connector IDs produced records for this package?
  const pkgConnectors = new Map<string, Set<string>>();
  for (const [connId, conn] of Object.entries(summary.byConnector)) {
    for (const slice of conn.dimensions['package'] ?? []) {
      if (!pkgConnectors.has(slice.value)) pkgConnectors.set(slice.value, new Set());
      pkgConnectors.get(slice.value)!.add(connId);
    }
  }

  function inferType(name: string): string {
    // 1. Plugin-declared wins
    const declared = summary.packageTypes?.[name];
    if (declared) return declared;
    // 2. Connector-based heuristics (weakest signal — plugins should override)
    const conns = pkgConnectors.get(name) ?? new Set<string>();
    if (conns.has('electron'))    return 'electron';
    if (conns.has('playwright'))  return 'webapp';
    if (conns.has('storybook'))   return 'storybook';
    if (conns.has('drizzle'))     return 'drizzle';
    if (conns.has('prisma'))      return 'prisma';
    if (conns.has('nextjs'))      return 'nextjs';
    // 3. Default
    return 'library';
  }

  return Array.from(allNames)
    .map(name => {
      const t = testing.get(name) ?? { passed: 0, failed: 0, skipped: 0, broken: 0, total: 0 };
      return {
        name,
        type:     inferType(name),
        tests:    t.total,
        passed:   t.passed,
        failed:   t.failed,
        skipped:  t.skipped,
        broken:   t.broken,
        passRate: t.total > 0 ? t.passed / t.total : null,
        coverage: coverageByPkg.get(name) ?? 0,
        findings: findingsByPkg.get(name) ?? { error: 0, warning: 0, info: 0 },
      };
    })
    .sort((a, b) => b.tests - a.tests);
}

/**
 * Build the suite tree from test records.
 * Groups records by source.file (testing connectors only).
 * Attempts to match each test file to an lcov coverage record.
 */
export function deriveSuites(records: RawRecord[], projectRoot?: string): SuiteInfo[] {
  // Build coverage map: source-file path → coverage fraction (0–1)
  const coverageByFile = new Map<string, number>();
  const covSumByPkg = new Map<string, { sum: number; count: number }>();
  for (const r of records) {
    if (r.connectorId === 'lcov') {
      const rawPct = r.metadata?.['coveragePct'];
      const frac = typeof rawPct === 'number' ? rawPct / 100 : (r.status === 'passed' ? 1 : 0);
      coverageByFile.set(r.source.file, frac);
      const pkg = r.dimensions['package'] ?? 'unknown';
      const prev = covSumByPkg.get(pkg) ?? { sum: 0, count: 0 };
      covSumByPkg.set(pkg, { sum: prev.sum + frac, count: prev.count + 1 });
    }
  }
  const coverageByPkg = new Map<string, number>(
    Array.from(covSumByPkg.entries()).map(([k, v]) => [k, v.count > 0 ? v.sum / v.count : 0])
  );

  // Only testing records
  const testRecords = records.filter(r => {
    const cat = r.connectorId;
    return cat !== 'lcov' && cat !== 'eslint' && cat !== 'typescript';
  });

  // Group by source.file
  const byFile = new Map<string, RawRecord[]>();
  for (const r of testRecords) {
    const grp = byFile.get(r.source.file) ?? [];
    grp.push(r);
    byFile.set(r.source.file, grp);
  }

  return Array.from(byFile.entries()).map(([file, recs]) => {
    const first = recs[0];

    // Heuristic: strip .test./.spec. suffix to find the source file
    const sourceFile = file.replace(/\.(test|spec)(\.(ts|tsx|js|jsx|mts|cts))$/, '$2');
    const covEntry = coverageByFile.get(sourceFile);
    const pkg = first.dimensions['package'] ?? 'unknown';
    const coverage = covEntry !== undefined ? covEntry : (coverageByPkg.get(pkg) ?? null);

    // Relativize file path when projectRoot is available
    const displayFile = projectRoot && file.startsWith(projectRoot)
      ? file.slice(projectRoot.length).replace(/^\//, '')
      : file;

    return {
      name:     suiteName(file),
      file:     displayFile,
      pkg,
      role:   first.dimensions['role']    ?? 'unknown',
      domain: first.dimensions['domain']  ?? 'unknown',
      layer:  first.dimensions['layer']   ?? 'unknown',
      coverage,
      tests: recs.map(r => ({
        id:           r.id,
        name:         r.name,
        fullName:     r.fullName,
        status:       r.status,
        duration:     r.duration,
        connectorId:  r.connectorId,
        errorMessage: extractError(r),
        bddSource:    extractBdd(r),
      })),
    };
  });
}
