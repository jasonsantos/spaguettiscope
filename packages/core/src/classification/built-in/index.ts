export { roleDimension } from './role.js'
export { domainDimension } from './domain.js'
export { packageDimension } from './package.js'

import { roleDimension } from './role.js'
import { domainDimension } from './domain.js'
import { packageDimension } from './package.js'
import type { DimensionDefinition } from '../model.js'

export const defaultDefinitions: DimensionDefinition[] = [
  roleDimension,
  domainDimension,
  packageDimension,
]
