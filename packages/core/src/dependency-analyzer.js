/**
 * SpaguettiScope Framework-Agnostic Dependency Analyzer
 * Analyzes import/export relationships and dependency graphs
 */

import { Project } from 'ts-morph';
import { extname } from 'path';

export class DependencyAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true
    });
    this.dependencies = new Map();
    this.imports = new Map();
    this.exports = new Map();
  }

  /**
   * Analyze dependencies for all files
   */
  async analyze(files) {
    console.log('Analyzing dependencies...');
    
    // Add source files to the project
    for (const file of files) {
      if (this.isAnalyzableFile(file.path)) {
        try {
          this.project.addSourceFileAtPath(file.fullPath);
        } catch (error) {
          console.warn(`Could not add file to project: ${file.path}`, error.message);
        }
      }
    }

    // Analyze each source file
    const sourceFiles = this.project.getSourceFiles();
    
    for (const sourceFile of sourceFiles) {
      await this.analyzeFile(sourceFile);
    }

    return {
      dependencies: Array.from(this.dependencies.values()),
      imports: Array.from(this.imports.values()),
      exports: Array.from(this.exports.values()),
      graph: this.buildDependencyGraph(),
      cycles: this.detectCycles(),
      metrics: this.calculateMetrics()
    };
  }

  /**
   * Check if file can be analyzed
   */
  isAnalyzableFile(filePath) {
    const ext = extname(filePath);
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  /**
   * Analyze a single file for imports and exports
   */
  async analyzeFile(sourceFile) {
    const filePath = sourceFile.getFilePath();
    const relativePath = filePath.replace(`${this.projectPath  }/`, '');

    // Analyze imports
    const importDeclarations = sourceFile.getImportDeclarations();
    const fileImports = [];

    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const importInfo = {
        from: relativePath,
        to: moduleSpecifier,
        type: this.getImportType(moduleSpecifier),
        namedImports: importDecl.getNamedImports().map(ni => ni.getName()),
        defaultImport: importDecl.getDefaultImport()?.getText(),
        namespaceImport: importDecl.getNamespaceImport()?.getText(),
        isTypeOnly: importDecl.isTypeOnly()
      };

      fileImports.push(importInfo);
    }

    this.imports.set(relativePath, fileImports);

    // Analyze exports
    const exportDeclarations = sourceFile.getExportDeclarations();
    const exportAssignments = sourceFile.getExportAssignments();
    const fileExports = [];

    // Named exports
    for (const exportDecl of exportDeclarations) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      
      if (moduleSpecifier) {
        // Re-export from another module
        fileExports.push({
          type: 're-export',
          from: moduleSpecifier,
          namedExports: exportDecl.getNamedExports().map(ne => ne.getName())
        });
      } else {
        // Direct named exports
        fileExports.push({
          type: 'named',
          namedExports: exportDecl.getNamedExports().map(ne => ne.getName())
        });
      }
    }

    // Default exports and export assignments
    for (const exportAssign of exportAssignments) {
      fileExports.push({
        type: 'default',
        expression: exportAssign.getExpression().getText()
      });
    }

    // Function and class exports
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
      const declaration = declarations[0];
      if (declaration) {
        fileExports.push({
          type: 'declaration',
          name,
          kind: declaration.getKindName()
        });
      }
    }

    this.exports.set(relativePath, fileExports);

    // Store dependency relationships
    const fileDeps = {
      file: relativePath,
      imports: fileImports,
      exports: fileExports,
      internalDependencies: fileImports.filter(imp => imp.type === 'internal').length,
      externalDependencies: fileImports.filter(imp => imp.type === 'external').length,
      fanOut: fileImports.length,
      fanIn: 0 // Will be calculated later
    };

    this.dependencies.set(relativePath, fileDeps);
  }

  /**
   * Determine import type (internal, external, relative)
   */
  getImportType(moduleSpecifier) {
    if (moduleSpecifier.startsWith('.')) {
      return 'relative';
    }
    if (moduleSpecifier.startsWith('@/') || moduleSpecifier.startsWith('~/')) {
      return 'internal';
    }
    if (moduleSpecifier.includes('/') && !moduleSpecifier.startsWith('@')) {
      return 'external';
    }
    return 'external';
  }

  /**
   * Build dependency graph
   */
  buildDependencyGraph() {
    const graph = {
      nodes: [],
      edges: []
    };

    // Create nodes for each file
    for (const [filePath, deps] of this.dependencies) {
      graph.nodes.push({
        id: filePath,
        type: this.getNodeType(filePath),
        fanIn: 0,
        fanOut: deps.fanOut,
        size: deps.imports.length + deps.exports.length
      });
    }

    // Create edges for dependencies
    for (const [filePath, deps] of this.dependencies) {
      for (const imp of deps.imports) {
        if (imp.type === 'relative' || imp.type === 'internal') {
          const targetPath = this.resolveImportPath(filePath, imp.to);
          if (targetPath && this.dependencies.has(targetPath)) {
            graph.edges.push({
              from: filePath,
              to: targetPath,
              type: imp.type,
              weight: 1
            });

            // Update fan-in count
            const targetNode = graph.nodes.find(n => n.id === targetPath);
            if (targetNode) {
              targetNode.fanIn++;
            }
          }
        }
      }
    }

    return graph;
  }

  /**
   * Get node type based on file path
   */
  getNodeType(filePath) {
    if (filePath.includes('/pages/') || filePath.includes('/app/')) {
      return 'route';
    }
    if (filePath.includes('/components/')) {
      return 'component';
    }
    if (filePath.includes('/hooks/')) {
      return 'hook';
    }
    if (filePath.includes('/utils/') || filePath.includes('/lib/')) {
      return 'utility';
    }
    return 'source';
  }

  /**
   * Resolve import path to actual file path (simplified)
   */
  resolveImportPath(fromPath, importPath) {
    // This is a simplified resolution
    // In a full implementation, this would handle:
    // - TypeScript path mapping
    // - Node.js module resolution
    // - File extensions
    
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Relative import - would need proper path resolution
      return null;
    }
    
    return null;
  }

  /**
   * Detect circular dependencies
   */
  detectCycles() {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (node, path) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart).concat([node]));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);

      const deps = this.dependencies.get(node);
      if (deps) {
        for (const imp of deps.imports) {
          if (imp.type === 'relative' || imp.type === 'internal') {
            const targetPath = this.resolveImportPath(node, imp.to);
            if (targetPath && this.dependencies.has(targetPath)) {
              dfs(targetPath, [...path, node]);
            }
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const filePath of this.dependencies.keys()) {
      if (!visited.has(filePath)) {
        dfs(filePath, []);
      }
    }

    return cycles;
  }

  /**
   * Calculate dependency metrics
   */
  calculateMetrics() {
    const deps = Array.from(this.dependencies.values());
    
    return {
      totalFiles: deps.length,
      totalImports: deps.reduce((sum, d) => sum + d.imports.length, 0),
      totalExports: deps.reduce((sum, d) => sum + d.exports.length, 0),
      averageFanOut: deps.length > 0 ? deps.reduce((sum, d) => sum + d.fanOut, 0) / deps.length : 0,
      maxFanOut: deps.length > 0 ? Math.max(...deps.map(d => d.fanOut)) : 0,
      filesWithHighFanOut: deps.filter(d => d.fanOut > 10).length,
      externalDependencies: new Set(
        deps.flatMap(d => 
          d.imports
            .filter(imp => imp.type === 'external')
            .map(imp => imp.to)
        )
      ).size,
      cyclomaticComplexity: this.detectCycles().length
    };
  }
}

