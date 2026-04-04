import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';

export function printBanner(): void {
  const title = figlet.textSync('spasco', { font: 'Small' });
  console.log(gradient.pastel.multiline(title));
}

export function printSuccess(message: string): void {
  console.log(chalk.green('  ✔ ') + message);
}

export function printWarning(message: string): void {
  console.log(chalk.yellow('  ⚠ ') + message);
}

export function printError(message: string): void {
  console.log(chalk.red('  ✘ ') + message);
}

export function printBox(content: string): void {
  console.log(boxen(content, { padding: 1, borderStyle: 'round', borderColor: 'cyan' }));
}

export function printSummaryLine(label: string, value: string): void {
  console.log('  ' + chalk.dim(label.padEnd(20)) + chalk.bold(value));
}
