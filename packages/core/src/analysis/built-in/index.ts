export { coverageGapRule } from './coverage.js'
export { unusedExportRule } from './unused.js'
export { circularDepRule } from './circular.js'
export { flakyTestRule } from './flakiness.js'

import { coverageGapRule } from './coverage.js'
import { unusedExportRule } from './unused.js'
import { circularDepRule } from './circular.js'
import { flakyTestRule } from './flakiness.js'
import type { AnalysisRule } from '../types.js'

export const builtInAnalysisRules: AnalysisRule[] = [
  coverageGapRule,
  unusedExportRule,
  circularDepRule,
  flakyTestRule,
]
