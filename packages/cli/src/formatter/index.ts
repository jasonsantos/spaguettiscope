import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';

const VERSION = '2.0.0';

export function printBanner(): void {
  const hasColor = chalk.level > 0;

  if (hasColor) {
    const br = chalk.hex('#555555'); // dark gray border
    const n  = chalk.hex('#FFD54F'); // yellow noodles

    const art = [
      br('  +----------------+'),
      br('  |') + n(' / __ \\ \\__/ __ ') + br('|'),
      br('  |') + n(' / /  \\ __ / /  ') + br('|'),
      br('  |') + n(' \\ \\  / /  \\ \\  ') + br('|'),
      br('  |') + n('  \\__/ /  \\ \\__ ') + br('|'),
      br('  |') + n(' / __ \\ \\__/ __ ') + br('|'),
      br('  |') + n(' / /  \\ ____/ / ') + br('|'),
      br('  +----------------+'),
    ];

    const noodleGrad = gradient(['#FFE082', '#F0C040', '#D4A017', '#E8B830']);
    const scopeGrad  = gradient(['#818CF8', '#A78BFA', '#22D3EE']);

    const title = figlet.textSync('SpaguettiScope', { font: 'Calvin S' });
    const titleLines = title.split('\n').filter((l: string) => l.trim());
    const coloredTitle = titleLines.map((line: string) => {
      const mid = Math.floor(line.length * 0.64);
      return noodleGrad(line.slice(0, mid)) + scopeGrad(line.slice(mid));
    });

    console.log('');
    for (const line of art) console.log(line);
    console.log('');
    for (const line of coloredTitle) console.log('  ' + line);
    console.log('  ' + chalk.hex('#94A3B8')('Code topology & entropy analysis for monorepos'));
    console.log('  ' + chalk.hex('#818CF8').bold(`v${VERSION}`));
    console.log('');
  } else {
    const title = figlet.textSync('SpaguettiScope', { font: 'Calvin S' });
    console.log('');
    console.log('  +----------------+');
    console.log('  | / __ \\ \\__/ __ |');
    console.log('  | / /  \\ __ / /  |');
    console.log('  | \\ \\  / /  \\ \\  |');
    console.log('  |  \\__/ /  \\ \\__ |');
    console.log('  | / __ \\ \\__/ __ |');
    console.log('  | / /  \\ ____/ / |');
    console.log('  +----------------+');
    console.log('');
    for (const line of title.split('\n')) console.log('  ' + line);
    console.log('  Code topology & entropy analysis for monorepos');
    console.log('  v' + VERSION);
    console.log('');
  }
}

export function printCommandHeader(command: string): void {
  const hasColor = chalk.level > 0;
  const label = hasColor
    ? chalk.hex('#FFD54F')('🍝 ') + chalk.hex('#A78BFA').bold(`spasco ${command}`)
    : `🍝 spasco ${command}`;
  console.log('');
  console.log('  ' + label);
  console.log('');
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
