export type { InitDetector, DetectedConnector, PluginDetector } from './interface.js'
export { vitestDetector } from './detectors/vitest.js'
export { lcovDetector } from './detectors/lcov.js'
export { playwrightDetector } from './detectors/playwright.js'
export { allureDetector } from './detectors/allure.js'
export { eslintDetector } from './detectors/eslint.js'

import { vitestDetector } from './detectors/vitest.js'
import { lcovDetector } from './detectors/lcov.js'
import { playwrightDetector } from './detectors/playwright.js'
import { allureDetector } from './detectors/allure.js'
import { eslintDetector } from './detectors/eslint.js'
import type { InitDetector } from './interface.js'

export const builtInDetectors: InitDetector[] = [
  vitestDetector,
  lcovDetector,
  playwrightDetector,
  allureDetector,
  eslintDetector,
]
