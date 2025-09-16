/**
 * SpaguettiScope CLI Interface
 * Beautiful command-line interface that orchestrates plugins and core analysis
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

import { Analyzer } from '@spaguettiscope/core';
import { Formatter } from './formatter.js';
import { PluginLoader } from './plugin-loader.js';

export class CLI {
  constructor() {
    this.program = new Command();
    this.formatter = new Formatter();
    this.pluginLoader = new PluginLoader();
    this.analyzer = new Analyzer();
    this.initialized = false;
  }

  /**
   * Initialize the CLI
   */
  async initialize() {
    if (this.initialized) {return;}

    // Initialize components
    await this.analyzer.initialize();
    await this.pluginLoader.initialize();
    
    this.setupCommands();
    this.initialized = true;
  }

  /**
   * Setup CLI commands
   */
  setupCommands() {
    this.program
      .name('spasco')
      .description('SpaguettiScope - Framework-agnostic code entropy analyzer')
      .version('1.0.0');

    // Analyze command
    this.program
      .command('analyze')
      .description('Analyze project entropy')
      .argument('[path]', 'Project path to analyze', '.')
      .option('-p, --plugin <name>', 'Framework plugin to use')
      .option('-v, --verbose', 'Verbose output')
      .option('-o, --output <file>', 'Output file path')
      .option('-f, --format <format>', 'Output format (json, html)', 'terminal')
      .action(async (path, options) => {
        await this.handleAnalyze(path, options);
      });

    // Report command
    this.program
      .command('report')
      .description('Generate detailed HTML report')
      .argument('[path]', 'Project path to analyze', '.')
      .option('-p, --plugin <name>', 'Framework plugin to use')
      .option('-o, --output <file>', 'Output file path', 'spaguettiscope-report.html')
      .action(async (path, options) => {
        await this.handleReport(path, options);
      });

    // Init command
    this.program
      .command('init')
      .description('Initialize SpaguettiScope configuration')
      .option('-p, --plugin <name>', 'Default framework plugin')
      .action(async (options) => {
        await this.handleInit(options);
      });

    // Plugins command
    this.program
      .command('plugins')
      .description('List available plugins')
      .action(async () => {
        await this.handlePlugins();
      });

    // Help command override
    this.program.helpOption('-h, --help', 'Display help information');
    this.program.on('--help', () => {
      console.log(this.formatter.formatHelp());
    });
  }

  /**
   * Handle analyze command
   */
  async handleAnalyze(projectPath, options) {
    try {
      console.log(this.formatter.createBanner());
      
      const resolvedPath = resolve(projectPath);
      
      if (!existsSync(resolvedPath)) {
        throw new Error(`Project path does not exist: ${resolvedPath}`);
      }

      // Get plugin
      let plugin;
      if (options.plugin) {
        plugin = this.pluginLoader.getPlugin(options.plugin);
        await this.pluginLoader.validatePlugin(options.plugin, resolvedPath);
      } else {
        const detected = await this.pluginLoader.autoDetectPlugin(resolvedPath);
        plugin = detected.plugin;
        console.log(this.formatter.formatStatus(`Using ${detected.name} plugin`, 'info'));
      }

      // Start analysis with beautiful progress
      const spinner = ora({
        text: this.formatter.formatStatus('Initializing analysis...', 'loading'),
        spinner: 'dots'
      }).start();

      try {
        // Perform analysis
        spinner.text = this.formatter.formatStatus('Scanning files...', 'loading');
        const factsBundle = await this.analyzer.analyze(resolvedPath, plugin, {
          verbose: options.verbose
        });

        spinner.succeed(this.formatter.formatStatus('Analysis complete!', 'success'));

        // Display results
        await this.displayResults(factsBundle, options);

        // Save output if requested
        if (options.output) {
          await this.saveOutput(factsBundle, options.output, options.format);
        }

      } catch (error) {
        spinner.fail(this.formatter.formatStatus('Analysis failed', 'error'));
        throw error;
      }

    } catch (error) {
      console.error(this.formatter.formatError(error));
      process.exit(1);
    }
  }

  /**
   * Handle report command
   */
  async handleReport(projectPath, options) {
    try {
      console.log(this.formatter.createBanner());
      
      const resolvedPath = resolve(projectPath);
      
      if (!existsSync(resolvedPath)) {
        throw new Error(`Project path does not exist: ${resolvedPath}`);
      }

      // Get plugin
      let plugin;
      if (options.plugin) {
        plugin = this.pluginLoader.getPlugin(options.plugin);
        await this.pluginLoader.validatePlugin(options.plugin, resolvedPath);
      } else {
        const detected = await this.pluginLoader.autoDetectPlugin(resolvedPath);
        plugin = detected.plugin;
      }

      const spinner = ora('Generating detailed report...').start();

      try {
        const factsBundle = await this.analyzer.analyze(resolvedPath, plugin);
        const htmlReport = await this.generateHTMLReport(factsBundle);
        
        writeFileSync(options.output, htmlReport);
        
        spinner.succeed(`Report generated: ${options.output}`);
        console.log(this.formatter.formatStatus(`Open ${options.output} in your browser`, 'success'));

      } catch (error) {
        spinner.fail('Report generation failed');
        throw error;
      }

    } catch (error) {
      console.error(this.formatter.formatError(error));
      process.exit(1);
    }
  }

  /**
   * Handle init command
   */
  async handleInit(options) {
    try {
      console.log(this.formatter.createBanner());
      console.log(this.formatter.formatStatus('Initializing SpaguettiScope configuration...', 'info'));

      const plugins = this.pluginLoader.listPlugins();
      
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'defaultPlugin',
          message: 'Select default framework plugin:',
          choices: plugins.map(p => ({ name: `${p.name} - ${p.description}`, value: p.name })),
          default: options.plugin || 'nextjs'
        },
        {
          type: 'confirm',
          name: 'enableVerbose',
          message: 'Enable verbose output by default?',
          default: false
        },
        {
          type: 'list',
          name: 'outputFormat',
          message: 'Default output format:',
          choices: ['terminal', 'json', 'html'],
          default: 'terminal'
        }
      ]);

      const config = {
        defaultPlugin: answers.defaultPlugin,
        verbose: answers.enableVerbose,
        outputFormat: answers.outputFormat,
        created: new Date().toISOString()
      };

      const configPath = join(process.cwd(), '.spaguettiscope.json');
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(this.formatter.formatStatus(`Configuration saved to ${configPath}`, 'success'));

    } catch (error) {
      console.error(this.formatter.formatError(error));
      process.exit(1);
    }
  }

  /**
   * Handle plugins command
   */
  async handlePlugins() {
    try {
      console.log(this.formatter.createBanner());
      
      const plugins = this.pluginLoader.listPlugins();
      
      if (plugins.length === 0) {
        console.log(this.formatter.formatStatus('No plugins found', 'warning'));
        return;
      }

      console.log(this.formatter.formatStatus(`Found ${plugins.length} plugin(s):`, 'info'));
      console.log();

      plugins.forEach(plugin => {
        console.log(`🔌 ${plugin.name}`);
        console.log(`   ${plugin.description}`);
        console.log(`   Version: ${plugin.version}`);
        console.log();
      });

    } catch (error) {
      console.error(this.formatter.formatError(error));
      process.exit(1);
    }
  }

  /**
   * Display analysis results
   */
  async displayResults(factsBundle, options) {
    const { entropy, insights, recommendations, fileStats } = factsBundle;

    // Project summary
    console.log(this.formatter.formatProjectSummary({
      fileCount: factsBundle.files.length,
      totalLines: fileStats.totalLines,
      components: factsBundle.projectStructure.components?.length || 0,
      routes: factsBundle.projectStructure.routes?.length || 0
    }));

    // Entropy score
    console.log(this.formatter.formatEntropyScore(entropy.entropyScore, entropy.classification));

    // Subscore breakdown
    if (options.verbose) {
      console.log(`\n${  this.formatter.formatSubScores(entropy.subScores)}`);
    }

    // Insights
    console.log(`\n${  this.formatter.formatInsights(insights)}`);

    // Recommendations
    console.log(`\n${  this.formatter.formatRecommendations(recommendations)}`);

    // File analysis (if verbose)
    if (options.verbose && factsBundle.complexity?.fileMetrics) {
      console.log(`\n${  this.formatter.formatFileAnalysis(
        factsBundle.complexity.fileMetrics.map(fm => ({
          path: fm.file,
          type: factsBundle.files.find(f => f.path === fm.file)?.type || 'unknown',
          lines: factsBundle.files.find(f => f.path === fm.file)?.lines || 0,
          complexity: fm
        }))
      )}`);
    }
  }

  /**
   * Save output to file
   */
  async saveOutput(factsBundle, outputPath, format) {
    const spinner = ora(`Saving ${format} output...`).start();

    try {
      let content;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(factsBundle, null, 2);
          break;
        case 'html':
          content = await this.generateHTMLReport(factsBundle);
          break;
        default:
          throw new Error(`Unsupported output format: ${format}`);
      }

      writeFileSync(outputPath, content);
      spinner.succeed(`Output saved to ${outputPath}`);

    } catch (error) {
      spinner.fail('Failed to save output');
      throw error;
    }
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(factsBundle) {
    // This would generate a beautiful HTML report
    // For now, return a simple HTML structure
    return `
<!DOCTYPE html>
<html>
<head>
    <title>SpaguettiScope Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 40px; }
        .score { font-size: 3em; font-weight: bold; text-align: center; margin: 20px 0; }
        .excellent { color: #22c55e; }
        .good { color: #06b6d4; }
        .moderate { color: #eab308; }
        .poor { color: #ef4444; }
        .critical { color: #dc2626; }
        .section { margin: 30px 0; }
        .metric { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="header">
        <h1>SpaguettiScope Analysis Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="section">
        <h2>Entropy Score</h2>
        <div class="score ${factsBundle.entropy.classification}">
            ${factsBundle.entropy.entropyScore.toFixed(1)}/10.0
        </div>
        <p style="text-align: center; font-size: 1.2em; text-transform: uppercase;">
            ${factsBundle.entropy.classification}
        </p>
    </div>
    
    <div class="section">
        <h2>Subscore Breakdown</h2>
        ${Object.entries(factsBundle.entropy.subScores).map(([key, score]) => `
            <div class="metric">
                <span>${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <span>${score.toFixed(1)}</span>
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${factsBundle.recommendations.map(rec => `
                <li><strong>${rec.title}</strong> - ${rec.description}</li>
            `).join('')}
        </ul>
    </div>
    
    <div class="section">
        <h2>Project Statistics</h2>
        <div class="metric">
            <span>Total Files</span>
            <span>${factsBundle.files.length}</span>
        </div>
        <div class="metric">
            <span>Lines of Code</span>
            <span>${factsBundle.fileStats.totalLines.toLocaleString()}</span>
        </div>
        <div class="metric">
            <span>Components</span>
            <span>${factsBundle.projectStructure.components?.length || 0}</span>
        </div>
        <div class="metric">
            <span>Routes</span>
            <span>${factsBundle.projectStructure.routes?.length || 0}</span>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Run the CLI
   */
  async run(argv = process.argv) {
    try {
      await this.initialize();
      
      // If no arguments provided, show help
      if (argv.length <= 2) {
        console.log(this.formatter.formatHelp());
        return;
      }
      
      await this.program.parseAsync(argv);
      
    } catch (error) {
      console.error(this.formatter.formatError(error));
      process.exit(1);
    }
  }
}

