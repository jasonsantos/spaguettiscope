import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { drizzleRules } from './rules.js'

export const drizzlePlugin: ScanPlugin = {
  id: 'drizzle',
  canApply,
  rules: () => drizzleRules,
}

export default drizzlePlugin
