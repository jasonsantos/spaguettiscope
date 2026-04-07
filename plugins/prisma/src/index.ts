import type { ScanPlugin, PluginDetector } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { prismaRules } from './rules.js'

export const prismaPlugin: ScanPlugin = {
  id: 'prisma',
  canApply,
  rules: () => prismaRules,
  packageType: () => 'prisma',
}

export const detector: PluginDetector = {
  id: 'prisma',
  detect: canApply,
}

export default prismaPlugin
