import type { ScanPlugin, PluginDetector } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { playwrightRules } from './rules.js'

export const playwrightPlugin: ScanPlugin = {
  id: 'playwright',
  canApply,
  rules: () => playwrightRules,
  // Playwright applies to any package with E2E tests — most likely a webapp.
  packageType: () => 'webapp',
}

export const detector: PluginDetector = {
  id: 'playwright',
  detect: canApply,
}

export default playwrightPlugin
