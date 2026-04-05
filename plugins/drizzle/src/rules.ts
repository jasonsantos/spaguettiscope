import type { Rule } from '@spaguettiscope/core'

export const drizzleRules: Rule[] = [
  // ── Schema definitions ──────────────────────────────────────────────────────
  {
    id: 'drizzle:schema',
    selector: {
      path: '**/*.ts',
      content: 'pgTable\\(|mysqlTable\\(|sqliteTable\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'schema' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Migrations ───────────────────────────────────────────────────────────────
  {
    id: 'drizzle:migration-sql',
    selector: { path: '**/migrations/**/*.sql' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'migration' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
  {
    id: 'drizzle:migration-ts',
    selector: { path: '**/migrations/**/*.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'migration' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Config ───────────────────────────────────────────────────────────────────
  // drizzle.config.ts / drizzle.config.js is the central Drizzle Kit config
  // that defines the schema path, migrations output dir, and DB dialect.
  // Content: defineConfig( is the drizzle-kit API — highly specific.
  {
    id: 'drizzle:config',
    selector: {
      path: '**/drizzle.config.{ts,js,mts,mjs}',
      content: 'defineConfig\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'drizzle-config' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── DB client / connection ────────────────────────────────────────────────────
  // Files that call drizzle() to instantiate the ORM client. The drizzle()
  // call is the unique fingerprint — it appears in connection files like
  // client.ts, db.ts, database.ts, index.ts under a database package.
  // Content anchors on the actual drizzle( invocation (not just an import).
  {
    id: 'drizzle:db-client',
    selector: {
      path: '**/*.ts',
      content: 'drizzle\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'db-client' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Repository / query layer ──────────────────────────────────────────────────
  // Repository files import drizzle-orm operators (eq, and, desc, etc.) and
  // call into the db client via a query helper. The graph predicate
  // `imports: "**/schema/**"` is the strongest signal — these files depend on
  // schema modules to reference table objects in .from() / .insert() calls.
  // Combined with a drizzle-orm import in the first 200 chars this avoids
  // false positives on unrelated files that happen to import schema types.
  {
    id: 'drizzle:repository',
    selector: {
      path: '**/*.ts',
      content: 'from .drizzle-orm',
      graph: { kind: 'imports', glob: '**/schema/**' },
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'repository' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },

  // ── Seeds ─────────────────────────────────────────────────────────────────────
  // Seed files populate the database with initial / test data. They live either
  // directly as seed.ts at any depth, or inside a seeds/ directory.
  {
    id: 'drizzle:seed',
    selector: { path: '**/seed.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'seed' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
  {
    id: 'drizzle:seed-dir',
    selector: { path: '**/seeds/**/*.{ts,js,cjs,mjs}' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'seed' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
]
