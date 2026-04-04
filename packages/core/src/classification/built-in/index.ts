export { roleDimension } from './role.ts';
export { domainDimension, inferDomainFromPath } from './domain.ts';
export { packageDimension } from './package.ts';

import { roleDimension } from './role.ts';
import { domainDimension } from './domain.ts';
import { packageDimension } from './package.ts';
import type { DimensionDefinition } from '../model.ts';

export const defaultDefinitions: DimensionDefinition[] = [
  roleDimension,
  domainDimension,
  packageDimension,
];
