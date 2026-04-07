export { coverageGapRule } from './coverage.js'
export { unusedExportRule } from './unused.js'
export { circularDepRule } from './circular.js'
export { flakyTestRule } from './flakiness.js'
export { layerViolationRule } from './layer-violation.js'
export { layerTypeLeakRule } from './layer-type-leak.js'

import { coverageGapRule } from './coverage.js'
import { unusedExportRule } from './unused.js'
import { circularDepRule } from './circular.js'
import { flakyTestRule } from './flakiness.js'
import { layerViolationRule } from './layer-violation.js'
import { layerTypeLeakRule } from './layer-type-leak.js'
import type { AnalysisRule } from '../types.js'

export const builtInAnalysisRules: AnalysisRule[] = [
  coverageGapRule,
  unusedExportRule,
  circularDepRule,
  flakyTestRule,
  layerViolationRule,
  layerTypeLeakRule,
]
