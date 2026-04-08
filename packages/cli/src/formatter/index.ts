import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';

// Golden noodle gradient (warm yellow → amber → gold)
const noodleGrad = gradient(['#FFE082', '#F0C040', '#D4A017', '#E8B830']);
// Scope gradient (indigo → purple → cyan — matching the brand)
const scopeGrad  = gradient(['#818CF8', '#A78BFA', '#22D3EE']);

export function printBanner(): void {
  const VERSION = '2.0.0';

  const fr = chalk.hex('#A78BFA');   // purple frame
  const nA = chalk.hex('#FFE082');   // noodle strand A — bright gold
  const nB = chalk.hex('#D4A017');   // noodle strand B — amber gold

  // Frame is exactly 22 visual chars per line.
  // Inner content is 18 chars. Two noodle strands cross at the centre (╳).
  // Strand A (bright gold): descends ╲ from top-left → bottom-right
  // Strand B (amber):        descends ╱ from top-right → bottom-left
  // At ╳ (row 4), A is on top — so ╳ is rendered in nA's colour.
  // After the cross the strands swap sides, carrying their identity with them.
  const art = [
    fr('  ╭──────────────────╮'),
    fr('  │') + ' ' + nA('∿∿∿∿╲') + '     ' + nB('╱∿∿∿∿') + '  ' + fr('│'),
    fr('  │') + '      ' + nA('╲') + '   ' + nB('╱') + '       ' + fr('│'),
    fr('  │') + '       ' + nA('╲') + ' ' + nB('╱') + '        ' + fr('│'),
    fr('  │') + '        ' + nA('╳') + '         ' + fr('│'),
    fr('  │') + '       ' + nB('╱') + ' ' + nA('╲') + '        ' + fr('│'),
    fr('  │') + '      ' + nB('╱') + '   ' + nA('╲') + '       ' + fr('│'),
    fr('  │') + ' ' + nB('∿∿∿∿╱') + '     ' + nA('╲∿∿∿∿') + '  ' + fr('│'),
    fr('  ╰──────────────────╯'),
  ];

  // Wordmark sits beside the art, vertically centred on rows 4-7
  const noodleGrad = gradient(['#FFE082', '#F0C040', '#D4A017', '#E8B830']);
  const scopeGrad  = gradient(['#818CF8', '#A78BFA', '#22D3EE']);
  const blank = '';

  const wordmark = [
    blank,
    blank,
    blank,
    blank,
    '  ' + noodleGrad('Spaguetti') + scopeGrad('Scope') + '  ' + chalk.hex('#818CF8').bold(`v${VERSION}`),
    '  ' + chalk.hex('#475569')('─────────────────────────────────'),
    '  ' + chalk.hex('#94A3B8')('Code topology & entropy analysis for monorepos'),
    blank,
    blank,
  ];

  console.log('');
  for (let i = 0; i < art.length; i++) {
    console.log(art[i] + (wordmark[i] ?? ''));
  }
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
