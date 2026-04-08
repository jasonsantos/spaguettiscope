# Dogfood Bugfixes Design

Fixes for 3 bugs found while dogfooding the tool on its own repository.

## Bug 1: `annotate resolve --as <dim> --all` ignores the dimension filter

**Symptom:** `--as domain --all` resolves all 11 pending entries (domains + layers) instead of only
the 4 domain entries.

**Root cause:** `packages/cli/src/commands/annotate.ts` lines 87-99 — when processing entries with
proposed keys (`key?`), the `--all` path strips the `?` suffix from ALL keys without checking if
`k === options.as + '?'`. The `--as` dimension is ignored entirely.

**Fix:** Only strip the `?` from the key that matches `options.as`. Leave other proposed keys
untouched. If any `key?` attributes remain after the operation, the entry stays `draft: true`.

**Acceptance criteria:**

- `annotate resolve --as domain --all` resolves only domain entries
- `annotate resolve --as layer --all` resolves only layer entries
- An entry with both `domain?` and `layer?` stays draft after resolving only one dimension
- The guidance message accurately reports how many entries were resolved

## Bug 2: `analyze` command only loads Allure test records

**Symptom:** `analyze` reports "Loaded 0 test records" on a repo with 425 vitest records, because it
hardcodes `AllureConnector` and skips all other connector types. This makes the entropy score differ
between `analyze` (4.5, no test data) and `dashboard` (3.1, with test data).

**Root cause:** `packages/cli/src/commands/analyze.ts` lines 73-97 — instantiates only
`AllureConnector` and filters for `connectorConfig.id === 'allure'`.

**Fix:** Extract the `CONNECTORS` array from `dashboard.ts` into a shared module
(`packages/cli/src/utils/connectors.ts`). Have both `analyze.ts` and `dashboard.ts` import it.
`analyze` iterates all configured connectors exactly like `dashboard` does.

The `analyze` command currently maps connector output to `TestRecord` for the analysis engine. It
should continue doing that for `runAnalysis`, while also passing the full `NormalizedRunRecord[]` to
`gatherEntropyInput` (which accepts `EntropyRecord[]`).

**Acceptance criteria:**

- `analyze` loads records from all configured connectors (vitest, allure, playwright, etc.)
- Entropy score from `analyze` matches `dashboard` when run on the same data
- `runAnalysis` still receives `TestRecord[]` as before (for flaky-test detection)

## Bug 3: TypeScript init detector generates incompatible config

**Symptom:** `spasco init` detects `tsconfig.json` files and emits
`{ id: 'typescript', tsconfigFile: '...' }`, but `TypescriptConnector` expects
`{ id: 'typescript', outputFile: '...' }` — a path to pre-generated `tsc` diagnostic output. Every
`dashboard` run fails with "config.outputFile must be a string path".

**Root cause:** `packages/core/src/init/detectors/typescript.ts` emits a config keyed on
`tsconfigFile` (the tsconfig itself), but the connector reads pre-computed `tsc` output. These are
fundamentally different inputs.

**Fix:** Remove the typescript init detector. The TypescriptConnector is a "bring your own output"
connector — it requires the user to pipe `tsc` output to a file and configure the path manually.
Auto-detecting `tsconfig.json` creates a broken config every time.

**Acceptance criteria:**

- `spasco init` does not emit typescript connector entries
- Existing manual typescript connector configs (`{ id: 'typescript', outputFile: '...' }`) continue
  to work
- `spasco dashboard` runs without TypescriptConnector errors on a freshly initialized project
