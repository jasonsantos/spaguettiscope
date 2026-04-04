import type { DimensionDefinition } from '../model.js';

export const packageDimension: DimensionDefinition = {
  name: 'package',
  patterns: [
    { value: 'web', globs: ['**/apps/web/**', '**/packages/web/**'] },
    { value: 'api', globs: ['**/apps/api/**', '**/packages/api/**'] },
    { value: 'admin', globs: ['**/apps/admin/**', '**/packages/admin/**'] },
    { value: 'mobile', globs: ['**/apps/mobile/**', '**/packages/mobile/**'] },
  ],
  // no fallback — single-package projects intentionally have no package tag
};
