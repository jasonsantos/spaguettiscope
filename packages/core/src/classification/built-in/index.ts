export { roleDimension } from './role.js'
export { domainDimension } from './domain.js'
export { packageDimension } from './package.js'
export { layerDimension } from './layer.js'

import { roleDimension } from './role.js'
import { domainDimension } from './domain.js'
import { packageDimension } from './package.js'
import { layerDimension } from './layer.js'
import type { DimensionDefinition } from '../model.js'

export const defaultDefinitions: DimensionDefinition[] = [
  roleDimension,
  domainDimension,
  packageDimension,
  layerDimension,
]
