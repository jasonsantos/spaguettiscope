import { Command } from 'commander';
import { runDashboard } from './commands/dashboard.js';
import { runScan } from './commands/scan.js';

const program = new Command();

program
  .name('spasco')
  .description('SpaguettiScope — Look at your spaghetti.')
  .version('2.0.0');

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

program.parse();
