import { Command } from 'commander';
import { runDashboard } from './commands/dashboard.js';
import { runScan } from './commands/scan.js';
import { runAnnotateList, runAnnotateResolve } from './commands/annotate.js';
import { runAnalyzeCommand } from './commands/analyze.js';
import { runInit } from './commands/init.js';
import { checkGuidance } from './formatter/guidance.js';

const program = new Command();

program.name('spasco').description('SpaguettiScope — Classify files, track test health, and measure entropy across your monorepo.').version('2.0.0');

program
  .command('dashboard')
  .description(
    'Read configured connectors (Vitest, LCov, Allure, etc.), aggregate test and coverage records, ' +
    'compute entropy, run analysis rules, and generate an HTML dashboard. ' +
    'Output goes to the configured outputDir (default: .spasco/reports/). ' +
    'Also appends a snapshot to .spasco/history.jsonl for trend tracking.'
  )
  .option('--config <file>', 'Path to spasco.config.json (default: auto-detected from project root)')
  .option('--output <dir>', 'Output directory for the generated HTML dashboard and data files (default: .spasco/reports/)')
  .option('--open', 'Open the dashboard in the default browser after generating')
  .option('--ci', 'CI mode: print a terminal summary only, skip HTML generation. Useful for CI logs.')
  .action(async (options) => {
    try {
      await runDashboard(options);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description(
    'Scan all project files, apply classification rules (built-in + plugins), and merge results ' +
    'into the skeleton file (.spasco/skeleton.yaml). Discovers workspace packages, infers domains ' +
    'from package names, proposes layer assignments from directory structure, and analyzes import ' +
    'directions to draft a layer policy. New entries get proposed values (key?) to confirm with ' +
    '`annotate resolve`.'
  )
  .action(async () => {
    try {
      await runScan();
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

const annotate = program.command('annotate').description('Manage skeleton annotations');

annotate
  .command('list')
  .description(
    'List all skeleton entries with unresolved dimensions — entries marked with ? (unknown) or ' +
    'key? (proposed draft). Shows the proposed value and source for each. Use this to review ' +
    'what scan detected before confirming with `annotate resolve`.'
  )
  .action(async () => {
    try {
      await runAnnotateList();
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

annotate
  .command('resolve [values]')
  .description(
    'Confirm or override proposed dimension values in the skeleton. Pass --all to accept all ' +
    'proposals for a dimension, or provide specific values to override. Resolving converts ' +
    'draft entries (key?) into confirmed entries (key) and removes the draft flag.'
  )
  .option('--all', 'Resolve all pending entries for the specified dimension, accepting proposed values')
  .requiredOption('--as <dimension>', 'The dimension to resolve (e.g., domain, layer, role). Required.')
  .option(
    '--add <attrs>',
    'Extra key=value attributes to set alongside the resolution (comma-separated, e.g., layer=service,tag=reviewed)'
  )
  .action(
    async (values: string | undefined, options: { all: boolean; as: string; add?: string }) => {
      try {
        await runAnnotateResolve({
          values: options.all
            ? []
            : (values ?? '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean),
          all: options.all,
          as: options.as,
          add: options.add,
        });
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
    }
  );

program
  .command('analyze')
  .description(
    'Run all analysis rules (built-in + configured analysisPlugins) over the file topology, ' +
    'import graph, and test records. Computes the entropy score. Outputs findings grouped by ' +
    'kind and severity. Always exits 0 — use `check` for CI gating.'
  )
  .option('--ci', 'CI mode: no HTML output, just terminal summary')
  .action(async options => {
    try {
      await runAnalyzeCommand({ ci: options.ci })
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('check')
  .description(
    'Same as analyze but exits 1 if findings of the specified severity exist, or if entropy ' +
    'exceeds --max-entropy. Designed for CI gates. Combine --severity and --max-entropy for ' +
    'comprehensive quality gates.'
  )
  .option('--severity <level>', 'Minimum severity to fail on: "error" (default), "warning", or "info"', 'error')
  .option('--max-entropy <threshold>', 'Fail if overall entropy score exceeds this value (0-10 scale, e.g., 7.0)', parseFloat)
  .action(async options => {
    try {
      const { summary, entropy } = await runAnalyzeCommand({ ci: true })
      const severityFail =
        options.severity === 'info'
          ? summary.error + summary.warning + summary.info > 0
          : options.severity === 'warning'
            ? summary.error + summary.warning > 0
            : summary.error > 0
      const entropyFail = options.maxEntropy !== undefined && entropy.score > options.maxEntropy
      const passed = !severityFail && !entropyFail

      console.log(
        checkGuidance({
          passed,
          entropyScore: entropy.score,
          maxEntropy: options.maxEntropy,
          severity: options.severity ?? 'error',
          errorCount: summary.error,
          warningCount: summary.warning,
        })
      )

      if (!passed) process.exit(1)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('init')
  .description(
    'Auto-detect installed tools (Vitest, LCov, Playwright, Allure, ESLint, TypeScript) and ' +
    'workspace plugins (@spaguettiscope/plugin-*), then write a ready-to-use spasco.config.json. ' +
    'Refuses to overwrite an existing config. Use --interactive to confirm each detector.'
  )
  .option('--interactive', 'Prompt to confirm each detected connector and plugin before writing config')
  .option('--plugins <ids>', 'Comma-separated plugin module IDs to load detectors from (e.g., @spaguettiscope/plugin-nextjs)')
  .action(async (options: { interactive?: boolean; plugins?: string }) => {
    try {
      await runInit({ interactive: options.interactive, plugins: options.plugins })
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program.parse();
