/**
 * SpaguettiScope Core Analyzer
 * Framework-agnostic analysis engine that orchestrates all analysis components
 */

import { FileScanner } from './file-scanner.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';
import { ComplexityCalculator } from './complexity-calculator.js';
import { EntropyEngine } from './entropy-engine.js';

export class Analyzer {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the analyzer
   */
  async initialize() {
    this.initialized = true;
  }

  /**
   * Analyze a project using a framework plugin
   */
  async analyze(projectPath, plugin, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Starting analysis of: ${projectPath}`);
    console.log(`Using plugin: ${plugin.name}`);
    
    try {
      // Step 1: Let the plugin discover the project structure
      const projectStructure = await plugin.discover(projectPath, options);
      
      // Step 2: Scan files using the plugin's patterns
      const fileScanner = new FileScanner(projectPath, plugin);
      const files = await fileScanner.scan();
      
      // Step 3: Analyze dependencies
      const dependencyAnalyzer = new DependencyAnalyzer(projectPath);
      const dependencyResults = await dependencyAnalyzer.analyze(files);
      
      // Step 4: Calculate complexity
      const complexityCalculator = new ComplexityCalculator();
      const complexityResults = await complexityCalculator.calculate(files);
      
      // Step 5: Calculate entropy
      const entropyEngine = new EntropyEngine();
      const entropyResults = entropyEngine.calculateEntropy({
        files,
        dependencies: dependencyResults,
        complexity: complexityResults,
        projectStructure
      });

      // Combine all results into the Facts Bundle
      const factsBundle = {
        projectPath,
        plugin: plugin.name,
        timestamp: new Date().toISOString(),
        
        // File analysis
        files,
        fileStats: fileScanner.getStats(files),
        
        // Framework-specific structure
        projectStructure,
        
        // Dependency analysis
        dependencies: dependencyResults,
        
        // Complexity analysis
        complexity: complexityResults,
        
        // Entropy analysis
        entropy: entropyResults,
        entropyScore: entropyResults.entropyScore,
        subScores: entropyResults.subScores,
        classification: entropyResults.classification,
        recommendations: entropyResults.recommendations,
        insights: entropyEngine.getInsights(entropyResults)
      };

      console.log(`Analysis complete. Entropy score: ${entropyResults.entropyScore} (${entropyResults.classification})`);
      return factsBundle;
      
    } catch (error) {
      console.error('Analysis failed:', error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze specific aspects of the project
   */
  async analyzeAspect(projectPath, plugin, aspect, options = {}) {
    const fileScanner = new FileScanner(projectPath, plugin);
    const files = await fileScanner.scan();

    switch (aspect) {
      case 'files':
        return {
          files,
          stats: fileScanner.getStats(files)
        };
        
      case 'dependencies':
        const dependencyAnalyzer = new DependencyAnalyzer(projectPath);
        return await dependencyAnalyzer.analyze(files);
        
      case 'complexity':
        const complexityCalculator = new ComplexityCalculator();
        return await complexityCalculator.calculate(files);
        
      case 'structure':
        return await plugin.discover(projectPath, options);
        
      case 'entropy':
        // Need all data for entropy calculation
        return await this.analyze(projectPath, plugin, options);
        
      default:
        throw new Error(`Unknown analysis aspect: ${aspect}`);
    }
  }

  /**
   * Get analysis summary for quick overview
   */
  async getQuickSummary(projectPath, plugin, options = {}) {
    const fileScanner = new FileScanner(projectPath, plugin);
    const files = await fileScanner.scan();
    const stats = fileScanner.getStats(files);
    
    const projectStructure = await plugin.discover(projectPath, options);
    
    return {
      projectPath,
      plugin: plugin.name,
      timestamp: new Date().toISOString(),
      fileCount: files.length,
      totalLines: stats.totalLines,
      totalSize: stats.totalSize,
      fileTypes: stats.fileTypes,
      extensions: stats.extensions,
      routes: projectStructure.routes?.length || 0,
      components: projectStructure.components?.length || 0
    };
  }

  /**
   * Validate plugin compatibility
   */
  async validatePlugin(projectPath, plugin) {
    try {
      const canAnalyze = await plugin.canAnalyze(projectPath);
      if (!canAnalyze) {
        throw new Error(`Plugin ${plugin.name} cannot analyze project at ${projectPath}`);
      }
      return true;
    } catch (error) {
      throw new Error(`Plugin validation failed: ${error.message}`);
    }
  }
}

// Export the plugin interface for plugin developers
export { AnalyzerPlugin } from './plugin-interface.js';

// Export individual components for advanced usage
export { FileScanner } from './file-scanner.js';
export { DependencyAnalyzer } from './dependency-analyzer.js';
export { ComplexityCalculator } from './complexity-calculator.js';
export { EntropyEngine } from './entropy-engine.js';

