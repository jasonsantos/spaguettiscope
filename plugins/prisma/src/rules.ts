import type { Rule } from '@spaguettiscope/core'

export const prismaRules: Rule[] = [
  // ── Schema definition ─────────────────────────────────────────────────────
  {
    id: 'prisma:schema',
    selector: { path: '**/schema.prisma' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'schema' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Migrations ────────────────────────────────────────────────────────────
  {
    id: 'prisma:migration',
    selector: { path: '**/migrations/**' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'migration' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── DB client / singleton ─────────────────────────────────────────────────
  // Every Prisma project creates exactly one PrismaClient instance (the
  // singleton) to avoid connection pool exhaustion. These files — commonly
  // named lib/prisma.ts, lib/db.ts, src/client.ts — import or instantiate
  // PrismaClient, which appears in the first 200 chars via the import statement.
  // The globalForPrisma pattern (Next.js hot-reload safe) is also covered since
  // the PrismaClient import precedes it.
  {
    id: 'prisma:db-client',
    selector: {
      path: '**/*.{ts,js,mts,mjs}',
      content: 'PrismaClient',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'db-client' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Client extensions / middleware ────────────────────────────────────────
  // Prisma v4+ uses $extends() to add computed fields, result extensions, and
  // query middleware. Older versions use $use() for middleware hooks. Both
  // patterns configure cross-cutting concerns (soft delete, audit logging,
  // caching) at the client level, making them infrastructure-layer concerns.
  {
    id: 'prisma:db-middleware',
    selector: {
      path: '**/*.{ts,js,mts,mjs}',
      content: '\\$extends\\(|\\$use\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'db-middleware' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Repository / data access layer ────────────────────────────────────────
  // Repository files wrap Prisma queries to encapsulate data access logic.
  // They import types and models directly from @prisma/client — this import
  // appears in the first 200 chars and is the canonical signal that a file
  // belongs to the data access layer (as opposed to the singleton which
  // imports PrismaClient, caught by prisma:db-client above).
  // Covers: class-based repositories, function-based DAL modules, helpers.
  {
    id: 'prisma:repository',
    selector: {
      path: '**/*.{ts,js,mts,mjs}',
      content: "from '@prisma/client'|from \"@prisma/client\"",
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'repository' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Seeds ─────────────────────────────────────────────────────────────────
  {
    id: 'prisma:seed',
    selector: { path: '**/seed.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'seed' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
]
