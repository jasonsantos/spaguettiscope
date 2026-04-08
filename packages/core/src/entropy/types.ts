export interface EntropySubscore {
  score: number       // 0-10
  available: boolean  // false if no data for this subscore
}

export interface EntropyResult {
  score: number       // 0-10 weighted composite
  classification: 'excellent' | 'good' | 'moderate' | 'poor' | 'critical'
  subscores: {
    stability: EntropySubscore
    boundaries: EntropySubscore
    coverage: EntropySubscore
    violations: EntropySubscore
    classification: EntropySubscore
  }
}

export interface EntropyInput {
  /** Total source files in scope */
  fileCount: number
  /** Test pass rate 0-1 (undefined if no test records) */
  passRate?: number
  /** Ratio of flaky tests (10-90% failure) to total tests, 0-1 */
  flakyRatio?: number
  /** Number of files involved in circular import cycles */
  circularDepFiles: number
  /** Total import edges in scope */
  edgeCount: number
  /** Max fan-out (imports from a single file) */
  maxFanOut: number
  /** Number of files with no importers and not entry points */
  unusedExports: number
  /** LCov coverage rate 0-1 (undefined if no lcov data) */
  lcovCoverage?: number
  /** Number of coverage-gap findings */
  coverageGaps: number
  /** Findings by severity */
  findingsByWeight: number  // error*3 + warning*1 + info*0.5
  /** Ratio of skeleton entries with all dimensions resolved (not draft, not ?) */
  resolvedRatio: number
}

export const ENTROPY_THRESHOLDS = {
  excellent: 3.0,
  good: 5.0,
  moderate: 7.0,
  poor: 9.0,
} as const

export const SUBSCORE_WEIGHTS = {
  stability: 0.25,
  boundaries: 0.25,
  coverage: 0.20,
  violations: 0.15,
  classification: 0.15,
} as const

export function classifyEntropy(score: number): EntropyResult['classification'] {
  if (score < ENTROPY_THRESHOLDS.excellent) return 'excellent'
  if (score < ENTROPY_THRESHOLDS.good) return 'good'
  if (score < ENTROPY_THRESHOLDS.moderate) return 'moderate'
  if (score < ENTROPY_THRESHOLDS.poor) return 'poor'
  return 'critical'
}
