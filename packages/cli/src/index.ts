import { Command } from 'commander';
import { runDashboard } from './commands/dashboard.js';
import { runScan } from './commands/scan.js';
import { runAnnotateList, runAnnotateResolve } from './commands/annotate.js';
import { runAnalyzeCommand } from './commands/analyze.js';
import { runInit } from './commands/init.js';

const program = new Command();

program.name('spasco').description('SpaguettiScope — Look at your spaghetti.').version('2.0.0');

program
  .command('dashboard')
  .description('Generate run quality dashboard from CI artifacts')
  .option('--config <file>', 'Path to config file')
  .option('--output <dir>', 'Output directory for dashboard', './reports')
  .option('--open', 'Open dashboard in browser after generating')
  .option('--ci', 'CI mode: terminal summary only, no HTML output')
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
  .description('Scan project files with rules and merge results into skeleton')
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
  .description('List all unresolved ? entries in the skeleton')
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
    'Resolve ? entries. [values] is comma-separated captured values, or use --all to resolve all'
  )
  .option('--all', 'Resolve all pending ? entries', false)
  .requiredOption('--as <dimension>', 'Dimension name to assign (e.g. domain)')
  .option(
    '--add <attrs>',
    'Extra key=value pairs to add (comma-separated, e.g. layer=service,tag=tentative)'
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
  .description('Run analysis rules and surface findings')
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
  .description('Run analysis rules and exit 1 if any error-severity findings exist')
  .option('--severity <level>', 'Treat this severity and above as errors', 'error')
  .option('--max-entropy <threshold>', 'Exit 1 if overall entropy exceeds this value (0-10)', parseFloat)
  .action(async options => {
    try {
      const { summary, entropy } = await runAnalyzeCommand({ ci: true })
      const hasErrors =
        options.severity === 'info'
          ? summary.error + summary.warning + summary.info > 0
          : options.severity === 'warning'
            ? summary.error + summary.warning > 0
            : summary.error > 0
      if (hasErrors) process.exit(1)
      if (options.maxEntropy !== undefined && entropy.score > options.maxEntropy) {
        console.error(`Entropy ${entropy.score} exceeds threshold ${options.maxEntropy}`)
        process.exit(1)
      }
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Auto-detect CI tools and generate spasco.config.json')
  .option('--interactive', 'Prompt to confirm each detected connector')
  .option('--plugins <ids>', 'Comma-separated plugin module IDs to load detectors from')
  .action(async (options: { interactive?: boolean; plugins?: string }) => {
    try {
      await runInit({ interactive: options.interactive, plugins: options.plugins })
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program.parse();
