import { Command } from 'commander';
import { runDashboard } from './commands/dashboard.js';
import { runScan } from './commands/scan.js';
import { runAnnotateList, runAnnotateResolve } from './commands/annotate.js';

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

program.parse();
