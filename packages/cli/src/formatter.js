/**
 * SpaguettiScope Beautiful Terminal Formatter
 * Creates gorgeous terminal output with gradients, animations, and branding
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import Table from 'cli-table3';
import boxen from 'boxen';
import terminalLink from 'terminal-link';

export class Formatter {
  constructor() {
    // SpaguettiScope brand colors (cyan to magenta gradient)
    this.brandGradient = gradient(['#00D4FF', '#FF00FF']);
    this.successGradient = gradient(['#00FF88', '#00D4FF']);
    this.warningGradient = gradient(['#FFD700', '#FF8C00']);
    this.errorGradient = gradient(['#FF4444', '#CC0000']);
    
    // Entropy classification colors
    this.entropyColors = {
      excellent: chalk.green,
      good: chalk.cyan,
      moderate: chalk.yellow,
      poor: chalk.red,
      critical: chalk.redBright.bold
    };
  }

  /**
   * Create the SpaguettiScope banner
   */
  createBanner() {
    const logo = figlet.textSync('SpaguettiScope', {
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted'
    });
    
    return `${this.brandGradient(logo)  }\n${ 
           chalk.gray('Framework-agnostic code entropy analyzer')  }\n${ 
           chalk.gray('Cool but serious. Built for developers.')  }\n`;
  }

  /**
   * Create a beautiful progress bar
   */
  createProgressBar(current, total, label = '') {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(barLength - filledLength);
    
    const bar = this.brandGradient(filled) + chalk.gray(empty);
    const percentText = chalk.bold(`${percentage}%`);
    
    return `${label} ${bar} ${percentText}`;
  }

  /**
   * Format entropy score with beautiful styling
   */
  formatEntropyScore(score, classification) {
    const colorFn = this.entropyColors[classification] || chalk.white;
    const scoreText = score.toFixed(1);
    
    const box = boxen(
      `${colorFn.bold('ENTROPY SCORE')}\n\n` +
      `${colorFn.bold(scoreText)}/10.0\n` +
      `${colorFn(classification.toUpperCase())}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: this.getClassificationColor(classification),
        textAlignment: 'center'
      }
    );
    
    return box;
  }

  /**
   * Format subscore breakdown
   */
  formatSubScores(subScores) {
    const table = new Table({
      head: [
        chalk.bold('Dimension'),
        chalk.bold('Score'),
        chalk.bold('Impact'),
        chalk.bold('Status')
      ],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    const dimensions = {
      complexity: { name: 'Complexity', impact: 'Maintainability' },
      boundaries: { name: 'Boundaries', impact: 'Scalability' },
      redundancy: { name: 'Redundancy', impact: 'Efficiency' },
      bundle: { name: 'Bundle', impact: 'Performance' },
      hotspots: { name: 'Hotspots', impact: 'Stability' },
      coverage: { name: 'Coverage', impact: 'Reliability' }
    };

    Object.entries(subScores).forEach(([key, score]) => {
      const dimension = dimensions[key];
      const status = this.getScoreStatus(score);
      const coloredScore = this.colorizeScore(score);
      
      table.push([
        dimension.name,
        coloredScore,
        chalk.gray(dimension.impact),
        status
      ]);
    });

    return table.toString();
  }

  /**
   * Format recommendations list
   */
  formatRecommendations(recommendations) {
    if (recommendations.length === 0) {
      return chalk.green('✨ No recommendations - your code looks great!');
    }

    let output = chalk.bold.underline('🎯 Recommendations:\n\n');
    
    recommendations.forEach((rec, index) => {
      const priority = this.formatPriority(rec.priority);
      const category = chalk.gray(`[${rec.category}]`);
      const impact = chalk.cyan(`→ ${rec.impact}`);
      
      output += `${index + 1}. ${priority} ${chalk.bold(rec.title)} ${category}\n`;
      output += `   ${chalk.gray(rec.description)}\n`;
      output += `   ${impact}\n\n`;
    });

    return output;
  }

  /**
   * Format file analysis table
   */
  formatFileAnalysis(files, limit = 10) {
    const table = new Table({
      head: [
        chalk.bold('File'),
        chalk.bold('Type'),
        chalk.bold('Lines'),
        chalk.bold('Complexity'),
        chalk.bold('Status')
      ],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    const sortedFiles = files
      .filter(f => f.complexity)
      .sort((a, b) => (b.complexity.cyclomaticComplexity || 0) - (a.complexity.cyclomaticComplexity || 0))
      .slice(0, limit);

    sortedFiles.forEach(file => {
      const complexity = file.complexity.cyclomaticComplexity || 0;
      const status = complexity > 10 ? chalk.red('⚠️  High') : 
                    complexity > 5 ? chalk.yellow('⚡ Med') : 
                    chalk.green('✅ Low');
      
      table.push([
        chalk.cyan(this.truncatePath(file.path, 40)),
        chalk.gray(file.type),
        chalk.white(file.lines.toString()),
        this.colorizeComplexity(complexity),
        status
      ]);
    });

    return table.toString();
  }

  /**
   * Format project summary
   */
  formatProjectSummary(summary) {
    const stats = [
      ['Files', chalk.cyan(summary.fileCount.toString())],
      ['Lines of Code', chalk.cyan(summary.totalLines.toLocaleString())],
      ['Components', chalk.cyan((summary.components || 0).toString())],
      ['Routes', chalk.cyan((summary.routes || 0).toString())]
    ];

    let output = chalk.bold.underline('📊 Project Overview:\n\n');
    
    stats.forEach(([label, value]) => {
      output += `${chalk.gray(label.padEnd(15))} ${value}\n`;
    });

    return `${output  }\n`;
  }

  /**
   * Format insights section
   */
  formatInsights(insights) {
    let output = chalk.bold.underline('💡 Insights:\n\n');
    
    output += `${chalk.bold('Overall:')} ${insights.overall}\n\n`;
    
    if (insights.strengths.length > 0) {
      output += chalk.green.bold('✅ Strengths:\n');
      insights.strengths.forEach(strength => {
        output += `  • ${chalk.green(strength)}\n`;
      });
      output += '\n';
    }
    
    if (insights.weaknesses.length > 0) {
      output += chalk.red.bold('⚠️  Areas for Improvement:\n');
      insights.weaknesses.forEach(weakness => {
        output += `  • ${chalk.red(weakness)}\n`;
      });
      output += '\n';
    }
    
    if (insights.nextSteps.length > 0) {
      output += chalk.blue.bold('🚀 Next Steps:\n');
      insights.nextSteps.forEach(step => {
        output += `  • ${chalk.blue(step)}\n`;
      });
    }

    return output;
  }

  /**
   * Create a status message with spinner
   */
  formatStatus(message, type = 'info') {
    const icons = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      loading: '⏳'
    };
    
    const colors = {
      info: chalk.cyan,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      loading: chalk.blue
    };
    
    const icon = icons[type] || icons.info;
    const colorFn = colors[type] || colors.info;
    
    return `${icon} ${colorFn(message)}`;
  }

  /**
   * Create a beautiful error message
   */
  formatError(error) {
    const errorBox = boxen(
      `${chalk.red.bold('ERROR')}\n\n${chalk.red(error.message)}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red'
      }
    );
    
    return errorBox;
  }

  /**
   * Create help text with beautiful formatting
   */
  formatHelp() {
    const commands = [
      ['analyze <path>', 'Analyze project entropy', '--plugin=nextjs --verbose'],
      ['report <path>', 'Generate detailed report', '--format=html --output=report.html'],
      ['init', 'Initialize configuration', '--plugin=nextjs'],
      ['plugins', 'List available plugins', '']
    ];

    let output = `${this.createBanner()  }\n`;
    output += chalk.bold.underline('🚀 Commands:\n\n');
    
    commands.forEach(([cmd, desc, example]) => {
      output += `${chalk.cyan.bold(cmd.padEnd(20))} ${chalk.gray(desc)}\n`;
      if (example) {
        output += `${' '.repeat(20)} ${chalk.dim(`Example: spasco ${  cmd.split(' ')[0]  } ${  example}`)}\n`;
      }
      output += '\n';
    });

    output += chalk.bold.underline('🔌 Plugins:\n\n');
    output += `${chalk.cyan('nextjs'.padEnd(20))} ${chalk.gray('NextJS framework support')}\n`;
    output += `${chalk.dim('remix'.padEnd(20))} ${chalk.gray('Coming soon...')}\n`;
    output += `${chalk.dim('astro'.padEnd(20))} ${chalk.gray('Coming soon...')}\n\n`;

    output += chalk.bold.underline('🎨 Options:\n\n');
    output += `${chalk.cyan('--plugin'.padEnd(20))} ${chalk.gray('Specify framework plugin')}\n`;
    output += `${chalk.cyan('--verbose'.padEnd(20))} ${chalk.gray('Detailed output')}\n`;
    output += `${chalk.cyan('--output'.padEnd(20))} ${chalk.gray('Output file path')}\n`;
    output += `${chalk.cyan('--format'.padEnd(20))} ${chalk.gray('Output format (json, html)')}\n\n`;

    return output;
  }

  // Helper methods

  getClassificationColor(classification) {
    const colors = {
      excellent: 'green',
      good: 'cyan',
      moderate: 'yellow',
      poor: 'red',
      critical: 'red'
    };
    return colors[classification] || 'white';
  }

  getScoreStatus(score) {
    if (score < 3) {return chalk.green('✅ Excellent');}
    if (score < 5) {return chalk.cyan('👍 Good');}
    if (score < 7) {return chalk.yellow('⚡ Moderate');}
    if (score < 9) {return chalk.red('⚠️  Poor');}
    return chalk.redBright('🚨 Critical');
  }

  colorizeScore(score) {
    if (score < 3) {return chalk.green.bold(score.toFixed(1));}
    if (score < 5) {return chalk.cyan.bold(score.toFixed(1));}
    if (score < 7) {return chalk.yellow.bold(score.toFixed(1));}
    if (score < 9) {return chalk.red.bold(score.toFixed(1));}
    return chalk.redBright.bold(score.toFixed(1));
  }

  colorizeComplexity(complexity) {
    if (complexity < 5) {return chalk.green(complexity.toString());}
    if (complexity < 10) {return chalk.yellow(complexity.toString());}
    return chalk.red(complexity.toString());
  }

  formatPriority(priority) {
    const priorities = {
      high: chalk.red.bold('🔥 HIGH'),
      medium: chalk.yellow.bold('⚡ MED'),
      low: chalk.green.bold('💡 LOW')
    };
    return priorities[priority] || priorities.medium;
  }

  truncatePath(path, maxLength) {
    if (path.length <= maxLength) {return path;}
    return `...${  path.slice(-(maxLength - 3))}`;
  }
}

