/**
 * SpaguettiScope Complexity Calculator
 * Calculates various complexity metrics for code analysis
 */

import { parse } from '@typescript-eslint/parser';

export class ComplexityCalculator {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Calculate complexity for all files
   */
  async calculate(files) {
    console.log('Calculating complexity metrics...');
    
    for (const file of files) {
      if (this.isAnalyzableFile(file.path)) {
        try {
          const complexity = await this.calculateFileComplexity(file);
          this.metrics.set(file.path, complexity);
        } catch (error) {
          console.warn(`Could not analyze complexity for ${file.path}:`, error.message);
          this.metrics.set(file.path, this.getDefaultComplexity());
        }
      }
    }

    return {
      fileMetrics: Array.from(this.metrics.entries()).map(([path, metrics]) => ({
        file: path,
        ...metrics
      })),
      summary: this.calculateSummary()
    };
  }

  /**
   * Check if file can be analyzed for complexity
   */
  isAnalyzableFile(filePath) {
    return /\.(js|jsx|ts|tsx)$/.test(filePath) && 
           !filePath.includes('.test.') && 
           !filePath.includes('.spec.');
  }

  /**
   * Calculate complexity metrics for a single file
   */
  async calculateFileComplexity(file) {
    const content = file.content;
    
    try {
      // Parse the file
      const ast = parse(content, {
        loc: true,
        range: true,
        jsx: file.path.includes('.jsx') || file.path.includes('.tsx'),
        ecmaVersion: 2022,
        sourceType: 'module'
      });

      return {
        cyclomaticComplexity: this.calculateCyclomaticComplexity(ast),
        cognitiveComplexity: this.calculateCognitiveComplexity(ast),
        linesOfCode: this.countLinesOfCode(content),
        maintainabilityIndex: this.calculateMaintainabilityIndex(ast, content),
        halsteadMetrics: this.calculateHalsteadMetrics(ast),
        nestingDepth: this.calculateNestingDepth(ast),
        functionCount: this.countFunctions(ast),
        classCount: this.countClasses(ast),
        commentRatio: this.calculateCommentRatio(content)
      };
    } catch (parseError) {
      // Fallback to simpler analysis if parsing fails
      return this.calculateBasicComplexity(content);
    }
  }

  /**
   * Calculate Cyclomatic Complexity
   * Counts decision points in the code
   */
  calculateCyclomaticComplexity(ast) {
    let complexity = 1; // Base complexity

    const complexityNodes = [
      'IfStatement',
      'ConditionalExpression',
      'SwitchCase',
      'WhileStatement',
      'DoWhileStatement',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'CatchClause',
      'LogicalExpression'
    ];

    this.walkAST(ast, (node) => {
      if (complexityNodes.includes(node.type)) {
        complexity++;
      }
      
      // Handle logical operators
      if (node.type === 'LogicalExpression' && 
          (node.operator === '&&' || node.operator === '||')) {
        complexity++;
      }
    });

    return complexity;
  }

  /**
   * Calculate Cognitive Complexity
   * More sophisticated metric that considers nesting and control flow
   */
  calculateCognitiveComplexity(ast) {
    let complexity = 0;
    let nestingLevel = 0;

    const incrementingNodes = [
      'IfStatement',
      'ConditionalExpression', 
      'SwitchStatement',
      'WhileStatement',
      'DoWhileStatement',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'CatchClause'
    ];

    const nestingNodes = [
      'IfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'SwitchStatement',
      'CatchClause',
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression'
    ];

    this.walkAST(ast, (node, ancestors) => {
      if (incrementingNodes.includes(node.type)) {
        complexity += 1 + nestingLevel;
      }

      if (nestingNodes.includes(node.type)) {
        nestingLevel++;
      }
    });

    return complexity;
  }

  /**
   * Count lines of code (excluding comments and blank lines)
   */
  countLinesOfCode(content) {
    const lines = content.split('\n');
    let loc = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        loc++;
      }
    }

    return loc;
  }

  /**
   * Calculate Maintainability Index
   * Combines various metrics into a single maintainability score
   */
  calculateMaintainabilityIndex(ast, content) {
    const loc = this.countLinesOfCode(content);
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(ast);
    const halstead = this.calculateHalsteadMetrics(ast);
    
    // Simplified maintainability index calculation
    const mi = Math.max(0, 
      171 - 
      5.2 * Math.log(halstead.volume || 1) - 
      0.23 * cyclomaticComplexity - 
      16.2 * Math.log(loc || 1)
    );

    return Math.round(mi);
  }

  /**
   * Calculate Halstead Metrics
   * Measures program vocabulary and complexity
   */
  calculateHalsteadMetrics(ast) {
    const operators = new Set();
    const operands = new Set();
    let operatorCount = 0;
    let operandCount = 0;

    const operatorTypes = [
      'BinaryExpression',
      'UnaryExpression',
      'AssignmentExpression',
      'UpdateExpression',
      'LogicalExpression'
    ];

    this.walkAST(ast, (node) => {
      if (operatorTypes.includes(node.type)) {
        operators.add(node.operator || node.type);
        operatorCount++;
      }

      if (node.type === 'Identifier') {
        operands.add(node.name);
        operandCount++;
      }

      if (node.type === 'Literal') {
        operands.add(node.value);
        operandCount++;
      }
    });

    const n1 = operators.size; // Unique operators
    const n2 = operands.size;  // Unique operands
    const N1 = operatorCount;  // Total operators
    const N2 = operandCount;   // Total operands

    const vocabulary = n1 + n2;
    const length = N1 + N2;
    const volume = length * Math.log2(vocabulary || 1);
    const difficulty = (n1 / 2) * (N2 / (n2 || 1));
    const effort = difficulty * volume;

    return {
      vocabulary,
      length,
      volume: Math.round(volume),
      difficulty: Math.round(difficulty * 100) / 100,
      effort: Math.round(effort)
    };
  }

  /**
   * Calculate maximum nesting depth
   */
  calculateNestingDepth(ast) {
    let maxDepth = 0;
    let currentDepth = 0;

    const nestingNodes = [
      'IfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'SwitchStatement',
      'BlockStatement',
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression'
    ];

    this.walkAST(ast, (node, ancestors) => {
      if (nestingNodes.includes(node.type)) {
        currentDepth = ancestors.filter(ancestor => 
          nestingNodes.includes(ancestor.type)
        ).length;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
    });

    return maxDepth;
  }

  /**
   * Count functions in the file
   */
  countFunctions(ast) {
    let count = 0;

    this.walkAST(ast, (node) => {
      if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
        count++;
      }
    });

    return count;
  }

  /**
   * Count classes in the file
   */
  countClasses(ast) {
    let count = 0;

    this.walkAST(ast, (node) => {
      if (node.type === 'ClassDeclaration') {
        count++;
      }
    });

    return count;
  }

  /**
   * Calculate comment ratio
   */
  calculateCommentRatio(content) {
    const lines = content.split('\n');
    let commentLines = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('/*')) {
        inBlockComment = true;
        commentLines++;
      } else if (trimmed.endsWith('*/')) {
        inBlockComment = false;
        commentLines++;
      } else if (inBlockComment || trimmed.startsWith('//')) {
        commentLines++;
      }
    }

    return lines.length > 0 ? (commentLines / lines.length) * 100 : 0;
  }

  /**
   * Fallback complexity calculation for unparseable files
   */
  calculateBasicComplexity(content) {
    const lines = content.split('\n');
    const loc = this.countLinesOfCode(content);
    
    // Simple heuristic-based complexity
    const ifCount = (content.match(/\bif\b/g) || []).length;
    const forCount = (content.match(/\bfor\b/g) || []).length;
    const whileCount = (content.match(/\bwhile\b/g) || []).length;
    const switchCount = (content.match(/\bswitch\b/g) || []).length;
    
    const cyclomaticComplexity = 1 + ifCount + forCount + whileCount + switchCount;

    return {
      cyclomaticComplexity,
      cognitiveComplexity: cyclomaticComplexity * 1.2,
      linesOfCode: loc,
      maintainabilityIndex: Math.max(0, 100 - cyclomaticComplexity * 2),
      halsteadMetrics: { vocabulary: 0, length: 0, volume: 0, difficulty: 0, effort: 0 },
      nestingDepth: Math.min(10, Math.floor(cyclomaticComplexity / 3)),
      functionCount: (content.match(/function\b/g) || []).length,
      classCount: (content.match(/class\b/g) || []).length,
      commentRatio: this.calculateCommentRatio(content)
    };
  }

  /**
   * Get default complexity for files that can't be analyzed
   */
  getDefaultComplexity() {
    return {
      cyclomaticComplexity: 1,
      cognitiveComplexity: 1,
      linesOfCode: 0,
      maintainabilityIndex: 100,
      halsteadMetrics: { vocabulary: 0, length: 0, volume: 0, difficulty: 0, effort: 0 },
      nestingDepth: 0,
      functionCount: 0,
      classCount: 0,
      commentRatio: 0
    };
  }

  /**
   * Walk AST with ancestors tracking
   */
  walkAST(ast, callback) {
    const walk = (node, ancestors = []) => {
      callback(node, ancestors);
      
      for (const key in node) {
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach(item => {
              if (item && typeof item === 'object' && item.type) {
                walk(item, [...ancestors, node]);
              }
            });
          } else if (child.type) {
            walk(child, [...ancestors, node]);
          }
        }
      }
    };

    walk(ast);
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    const metrics = Array.from(this.metrics.values());
    
    if (metrics.length === 0) {
      return {
        averageComplexity: 0,
        maxComplexity: 0,
        totalLinesOfCode: 0,
        averageMaintainability: 100,
        highComplexityFiles: 0
      };
    }

    return {
      averageComplexity: metrics.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) / metrics.length,
      maxComplexity: Math.max(...metrics.map(m => m.cyclomaticComplexity)),
      totalLinesOfCode: metrics.reduce((sum, m) => sum + m.linesOfCode, 0),
      averageMaintainability: metrics.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / metrics.length,
      highComplexityFiles: metrics.filter(m => m.cyclomaticComplexity > 10).length,
      averageCognitiveComplexity: metrics.reduce((sum, m) => sum + m.cognitiveComplexity, 0) / metrics.length,
      totalFunctions: metrics.reduce((sum, m) => sum + m.functionCount, 0),
      totalClasses: metrics.reduce((sum, m) => sum + m.classCount, 0)
    };
  }
}

