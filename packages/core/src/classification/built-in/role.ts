import type { DimensionDefinition } from '../model.ts';

export const roleDimension: DimensionDefinition = {
  name: 'role',
  patterns: [
    {
      value: 'e2e',
      globs: ['**/e2e/**', '**/playwright/**', '**/cypress/**'],
    },
    {
      value: 'test',
      globs: ['**/__tests__/**', '**/tests/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    },
    {
      value: 'repository',
      globs: ['**/repositories/**', '**/*Repository.ts', '**/*Repository.tsx', '**/*repository.ts'],
    },
    {
      value: 'server-action',
      globs: ['**/actions/**', '**/*Action.ts', '**/*Actions.ts', '**/*action.ts'],
    },
    {
      value: 'hook',
      globs: ['**/hooks/**', '**/use[A-Z]*.ts', '**/use[A-Z]*.tsx'],
    },
    {
      value: 'business-logic',
      globs: ['**/lib/**', '**/domain/**', '**/services/**'],
    },
    {
      value: 'types',
      globs: ['**/types/**', '**/*.types.ts', '**/*.types.tsx', '**/schemas/**'],
    },
    {
      value: 'design-system',
      globs: ['**/ui/**', '**/primitives/**', '**/design-system/**'],
    },
    {
      value: 'api-route',
      globs: ['**/api/**'],
    },
    {
      value: 'client-component',
      globs: ['**/components/**/*.tsx', '**/components/**/*.ts'],
    },
    {
      value: 'server-component',
      globs: ['**/app/**/*.tsx', '**/app/**/*.ts', '**/pages/**/*.tsx', '**/pages/**/*.ts'],
    },
  ],
  fallback: 'unknown',
};
