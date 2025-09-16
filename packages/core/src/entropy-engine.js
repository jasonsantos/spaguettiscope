/**
 * SpaguettiScope Entropy Engine
 * Calculates the overall entropy score and generates recommendations
 */

export class EntropyEngine {
  constructor() {
    // Entropy calculation weights (can be configured)
    this.weights = {
      complexity: 0.25,      // Cognitive/cyclomatic complexity
      boundaries: 0.20,      // Architecture boundaries and coupling
      redundancy: 0.15,      // Code duplication and unused code
      bundle: 0.15,          // Bundle size and optimization
      hotspots: 0.15,        // Churn hotspots and maintenance burden
      coverage: 0.10         // Test and story coverage (negative weight)
    };

    this.thresholds = {
      excellent: 3.0,
      good: 5.0,
      moderate: 7.0,
      poor: 9.0
    };
  }

  /**
   * Calculate the overall entropy score
   */
  calculateEntropy(analysisData) {
    console.log('Calculating entropy score...');

    const subScores = {
      complexity: this.calculateComplexityScore(analysisData.complexity),
      boundaries: this.calculateBoundariesScore(analysisData.dependencies),
      redundancy: this.calculateRedundancyScore(analysisData.files),
      bundle: this.calculateBundleScore(analysisData.files),
      hotspots: this.calculateHotspotsScore(analysisData.files),
      coverage: this.calculateCoverageScore(analysisData.files)
    };

    // Calculate weighted entropy score
    const entropyScore = Object.entries(subScores).reduce((total, [key, score]) => {
      const weight = this.weights[key];
      const contribution = key === 'coverage' ? 
        weight * (10 - score) : // Coverage is inverse (higher coverage = lower entropy)
        weight * score;
      return total + contribution;
    }, 0);

    return {
      entropyScore: Math.round(entropyScore * 10) / 10,
      subScores,
      classification: this.classifyEntropy(entropyScore),
      recommendations: this.generateRecommendations(subScores, analysisData)
    };
  }

  /**
   * Calculate complexity subscore
   */
  calculateComplexityScore(complexityData) {
    if (!complexityData || !complexityData.summary) {
      return 5.0; // Default moderate score
    }

    const { 
      averageComplexity, 
      maxComplexity, 
      averageCognitiveComplexity,
      averageMaintainability 
    } = complexityData.summary;

    // Normalize complexity metrics to 0-10 scale
    const complexityScore = Math.min(10, averageComplexity / 2);
    const maxComplexityScore = Math.min(10, maxComplexity / 5);
    const cognitiveScore = Math.min(10, averageCognitiveComplexity / 3);
    const maintainabilityScore = Math.max(0, (100 - averageMaintainability) / 10);

    // Weighted average of complexity factors
    return (complexityScore * 0.3 + 
            maxComplexityScore * 0.3 + 
            cognitiveScore * 0.25 + 
            maintainabilityScore * 0.15);
  }

  /**
   * Calculate boundaries subscore (coupling and architecture)
   */
  calculateBoundariesScore(dependencyData) {
    if (!dependencyData || !dependencyData.metrics) {
      return 5.0;
    }

    const { 
      averageFanOut, 
      maxFanOut, 
      filesWithHighFanOut,
      cyclomaticComplexity,
      totalFiles 
    } = dependencyData.metrics;

    // High fan-out indicates poor boundaries
    const fanOutScore = Math.min(10, averageFanOut / 2);
    const maxFanOutScore = Math.min(10, maxFanOut / 10);
    const highFanOutRatio = totalFiles > 0 ? (filesWithHighFanOut / totalFiles) * 10 : 0;
    const cyclesScore = Math.min(10, cyclomaticComplexity * 2);

    return (fanOutScore * 0.3 + 
            maxFanOutScore * 0.3 + 
            highFanOutRatio * 0.2 + 
            cyclesScore * 0.2);
  }

  /**
   * Calculate redundancy subscore
   */
  calculateRedundancyScore(filesData) {
    if (!filesData || !Array.isArray(filesData)) {
      return 5.0;
    }

    // Analyze file patterns for potential duplication
    const componentFiles = filesData.filter(f => f.type === 'component');
    const utilityFiles = filesData.filter(f => f.type === 'utility');
    
    // Simple heuristics for redundancy
    const duplicateNamePattern = this.findDuplicatePatterns(componentFiles);
    const unusedFileRatio = this.estimateUnusedFiles(filesData);
    const largeFileCount = filesData.filter(f => f.lines > 500).length;
    const largeFileRatio = filesData.length > 0 ? (largeFileCount / filesData.length) * 10 : 0;

    return (duplicateNamePattern * 0.4 + 
            unusedFileRatio * 0.3 + 
            largeFileRatio * 0.3);
  }

  /**
   * Calculate bundle subscore
   */
  calculateBundleScore(filesData) {
    if (!filesData || !Array.isArray(filesData)) {
      return 5.0;
    }

    const totalLines = filesData.reduce((sum, f) => sum + (f.lines || 0), 0);
    const averageFileSize = filesData.length > 0 ? totalLines / filesData.length : 0;
    
    // Heuristics for bundle health
    const sizeScore = Math.min(10, averageFileSize / 100);
    const fileCountScore = Math.min(10, filesData.length / 50);
    
    // Check for potential bundle issues
    const jsFiles = filesData.filter(f => f.path.endsWith('.js') || f.path.endsWith('.jsx'));
    const tsFiles = filesData.filter(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'));
    const mixedLanguageScore = jsFiles.length > 0 && tsFiles.length > 0 ? 3 : 0;

    return (sizeScore * 0.4 + 
            fileCountScore * 0.4 + 
            mixedLanguageScore * 0.2);
  }

  /**
   * Calculate hotspots subscore
   */
  calculateHotspotsScore(filesData) {
    if (!filesData || !Array.isArray(filesData)) {
      return 5.0;
    }

    // Identify potential hotspots based on file characteristics
    const largeFiles = filesData.filter(f => f.lines > 300);
    const deeplyNestedFiles = filesData.filter(f => 
      f.directory && f.directory.split('/').length > 4
    );
    
    const hotspotRatio = filesData.length > 0 ? 
      ((largeFiles.length + deeplyNestedFiles.length) / filesData.length) * 10 : 0;
    
    // Files that might be frequently modified (heuristic)
    const utilityFiles = filesData.filter(f => 
      f.path.includes('util') || f.path.includes('helper') || f.path.includes('common')
    );
    const utilityRatio = filesData.length > 0 ? (utilityFiles.length / filesData.length) * 5 : 0;

    return Math.min(10, hotspotRatio * 0.7 + utilityRatio * 0.3);
  }

  /**
   * Calculate coverage subscore
   */
  calculateCoverageScore(filesData) {
    if (!filesData || !Array.isArray(filesData)) {
      return 5.0;
    }

    const sourceFiles = filesData.filter(f => 
      f.type !== 'test' && f.type !== 'story'
    );
    const testFiles = filesData.filter(f => f.type === 'test');
    const storyFiles = filesData.filter(f => f.type === 'story');

    const testCoverage = sourceFiles.length > 0 ? 
      (testFiles.length / sourceFiles.length) * 10 : 0;
    const storyCoverage = sourceFiles.length > 0 ? 
      (storyFiles.length / sourceFiles.length) * 10 : 0;

    // Higher coverage = lower entropy contribution
    return Math.max(0, 10 - (testCoverage * 0.7 + storyCoverage * 0.3));
  }

  /**
   * Find duplicate patterns in file names
   */
  findDuplicatePatterns(files) {
    const namePatterns = new Map();
    
    files.forEach(file => {
      const baseName = file.path.split('/').pop().replace(/\.(jsx?|tsx?)$/, '');
      const pattern = baseName.toLowerCase().replace(/[0-9]/g, '');
      
      if (!namePatterns.has(pattern)) {
        namePatterns.set(pattern, 0);
      }
      namePatterns.set(pattern, namePatterns.get(pattern) + 1);
    });

    const duplicates = Array.from(namePatterns.values()).filter(count => count > 1);
    return Math.min(10, duplicates.length);
  }

  /**
   * Estimate unused files ratio
   */
  estimateUnusedFiles(files) {
    // Simple heuristic: files with very few lines might be unused
    const potentiallyUnused = files.filter(f => 
      f.lines < 10 && f.type !== 'test' && f.type !== 'story'
    );
    
    return files.length > 0 ? (potentiallyUnused.length / files.length) * 10 : 0;
  }

  /**
   * Classify entropy level
   */
  classifyEntropy(score) {
    if (score < this.thresholds.excellent) {return 'excellent';}
    if (score < this.thresholds.good) {return 'good';}
    if (score < this.thresholds.moderate) {return 'moderate';}
    if (score < this.thresholds.poor) {return 'poor';}
    return 'critical';
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(subScores, analysisData) {
    const recommendations = [];

    // Complexity recommendations
    if (subScores.complexity > 7) {
      recommendations.push({
        title: 'Reduce code complexity',
        description: 'High complexity detected. Consider breaking large functions into smaller ones and reducing nesting depth.',
        priority: 'high',
        category: 'complexity',
        impact: 'maintainability'
      });
    }

    // Boundaries recommendations
    if (subScores.boundaries > 7) {
      recommendations.push({
        title: 'Improve architecture boundaries',
        description: 'High coupling detected. Consider implementing clearer module boundaries and reducing dependencies.',
        priority: 'high',
        category: 'architecture',
        impact: 'scalability'
      });
    }

    // Redundancy recommendations
    if (subScores.redundancy > 6) {
      recommendations.push({
        title: 'Eliminate code duplication',
        description: 'Potential code duplication found. Look for opportunities to extract reusable components and utilities.',
        priority: 'medium',
        category: 'redundancy',
        impact: 'maintainability'
      });
    }

    // Bundle recommendations
    if (subScores.bundle > 6) {
      recommendations.push({
        title: 'Optimize bundle size',
        description: 'Large bundle detected. Consider code splitting, lazy loading, and removing unused dependencies.',
        priority: 'medium',
        category: 'performance',
        impact: 'performance'
      });
    }

    // Coverage recommendations
    if (subScores.coverage > 7) {
      recommendations.push({
        title: 'Increase test coverage',
        description: 'Low test coverage detected. Add unit tests for critical components and business logic.',
        priority: 'medium',
        category: 'testing',
        impact: 'reliability'
      });
    }

    // Hotspots recommendations
    if (subScores.hotspots > 7) {
      recommendations.push({
        title: 'Address maintenance hotspots',
        description: 'Files with high maintenance burden identified. Consider refactoring frequently changed, complex files.',
        priority: 'high',
        category: 'maintenance',
        impact: 'productivity'
      });
    }

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return recommendations;
  }

  /**
   * Get entropy insights and trends
   */
  getInsights(entropyResult) {
    const { entropyScore, subScores, classification } = entropyResult;
    
    const insights = {
      overall: this.getOverallInsight(classification, entropyScore),
      strengths: this.identifyStrengths(subScores),
      weaknesses: this.identifyWeaknesses(subScores),
      trends: this.analyzeTrends(subScores),
      nextSteps: this.suggestNextSteps(subScores)
    };

    return insights;
  }

  /**
   * Get overall insight based on entropy score
   */
  getOverallInsight(classification, score) {
    const insights = {
      excellent: `Outstanding code health! Your codebase shows excellent organization and maintainability.`,
      good: `Good code health with minor areas for improvement. You're on the right track.`,
      moderate: `Moderate entropy detected. Some refactoring would improve maintainability.`,
      poor: `High entropy indicates significant technical debt. Prioritize refactoring efforts.`,
      critical: `Critical entropy levels detected. Immediate attention required to prevent further degradation.`
    };

    return insights[classification] || insights.moderate;
  }

  /**
   * Identify strengths in the codebase
   */
  identifyStrengths(subScores) {
    const strengths = [];
    
    Object.entries(subScores).forEach(([category, score]) => {
      if (score < 4) {
        const strengthMessages = {
          complexity: 'Well-structured, maintainable code with low complexity',
          boundaries: 'Clean architecture with good separation of concerns',
          redundancy: 'Minimal code duplication and good reusability',
          bundle: 'Optimized bundle size and efficient code organization',
          hotspots: 'Low maintenance burden with stable codebase',
          coverage: 'Excellent test and documentation coverage'
        };
        
        if (strengthMessages[category]) {
          strengths.push(strengthMessages[category]);
        }
      }
    });

    return strengths;
  }

  /**
   * Identify weaknesses in the codebase
   */
  identifyWeaknesses(subScores) {
    const weaknesses = [];
    
    Object.entries(subScores).forEach(([category, score]) => {
      if (score > 7) {
        const weaknessMessages = {
          complexity: 'High code complexity affecting maintainability',
          boundaries: 'Poor architecture boundaries and high coupling',
          redundancy: 'Significant code duplication and unused code',
          bundle: 'Large bundle size impacting performance',
          hotspots: 'High maintenance burden in critical areas',
          coverage: 'Insufficient test and documentation coverage'
        };
        
        if (weaknessMessages[category]) {
          weaknesses.push(weaknessMessages[category]);
        }
      }
    });

    return weaknesses;
  }

  /**
   * Analyze trends in the metrics
   */
  analyzeTrends(subScores) {
    // This would be enhanced with historical data
    const scores = Object.values(subScores);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    
    if (variance < 1) {
      return 'Consistent code quality across all metrics';
    } else if (variance > 4) {
      return 'High variance in code quality - some areas need focused attention';
    } else {
      return 'Moderate variance in code quality metrics';
    }
  }

  /**
   * Suggest next steps based on analysis
   */
  suggestNextSteps(subScores) {
    const sortedScores = Object.entries(subScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2);

    const nextSteps = sortedScores.map(([category, score]) => {
      const stepMessages = {
        complexity: 'Focus on refactoring complex functions and reducing nesting',
        boundaries: 'Implement clearer module boundaries and dependency management',
        redundancy: 'Identify and extract common patterns into reusable components',
        bundle: 'Implement code splitting and optimize bundle size',
        hotspots: 'Address high-churn files and improve code stability',
        coverage: 'Increase test coverage for critical business logic'
      };
      
      return stepMessages[category];
    }).filter(Boolean);

    return nextSteps;
  }
}

