import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { nextjsRules } from './rules.js'

export const nextjsPlugin: ScanPlugin = {
  id: 'nextjs',
  canApply,
  rules: () => nextjsRules,
  packageType: () => 'nextjs',
}

export default nextjsPlugin
