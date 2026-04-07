import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { prismaRules } from './rules.js'

export const prismaPlugin: ScanPlugin = {
  id: 'prisma',
  canApply,
  rules: () => prismaRules,
  packageType: () => 'prisma',
}

export default prismaPlugin
