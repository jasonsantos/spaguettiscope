/**
 * SpaguettiScope Plugin Interface
 * Defines the contract that all framework plugins must implement
 */

/**
 * @typedef {Object} FileInfo
 * @property {string} path - Relative path from project root
 * @property {string} fullPath - Absolute path to file
 * @property {string} content - File content
 * @property {string} type - File type (component, route, test, etc.)
 * @property {number} size - File size in bytes
 * @property {number} lines - Number of lines
 * @property {Object} metadata - Framework-specific metadata
 */

/**
 * @typedef {Object} DependencyInfo
 * @property {string} from - Source file path
 * @property {string} to - Target file/module path
 * @property {string} type - Dependency type (import, require, etc.)
 * @property {boolean} isExternal - Whether dependency is external
 * @property {string[]} imports - Named imports
 */

/**
 * @typedef {Object} RouteInfo
 * @property {string} path - Route path
 * @property {string} filePath - File that defines the route
 * @property {string} type - Route type (page, api, layout, etc.)
 * @property {boolean} dynamic - Whether route has dynamic segments
 * @property {Object} metadata - Framework-specific route metadata
 */

/**
 * @typedef {Object} ComponentInfo
 * @property {string} name - Component name
 * @property {string} path - File path
 * @property {string} type - Component type (client, server, etc.)
 * @property {string[]} dependencies - Component dependencies
 * @property {Object} metadata - Framework-specific component metadata
 */

/**
 * @typedef {Object} ProjectStructure
 * @property {FileInfo[]} files - All analyzed files
 * @property {DependencyInfo[]} dependencies - Dependency relationships
 * @property {RouteInfo[]} routes - Framework routes (if applicable)
 * @property {ComponentInfo[]} components - Framework components (if applicable)
 * @property {Object} metadata - Framework-specific project metadata
 */

/**
 * Base class for framework plugins
 */
export class AnalyzerPlugin {
  /**
   * @param {string} name - Plugin name
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Discover and analyze project structure
   * @param {string} projectPath - Path to project root
   * @param {Object} options - Analysis options
   * @returns {Promise<ProjectStructure>} Project structure
   */
  async discover(projectPath, options = {}) {
    throw new Error('Plugin must implement discover() method');
  }

  /**
   * Validate if this plugin can analyze the given project
   * @param {string} projectPath - Path to project root
   * @returns {Promise<boolean>} Whether plugin can analyze project
   */
  async canAnalyze(projectPath) {
    throw new Error('Plugin must implement canAnalyze() method');
  }

  /**
   * Get plugin configuration schema
   * @returns {Object} Configuration schema
   */
  getConfigSchema() {
    return {};
  }

  /**
   * Get framework-specific file patterns
   * @returns {string[]} Glob patterns for framework files
   */
  getFilePatterns() {
    return ['**/*.{js,jsx,ts,tsx}'];
  }

  /**
   * Get framework-specific ignore patterns
   * @returns {string[]} Glob patterns to ignore
   */
  getIgnorePatterns() {
    return [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**'
    ];
  }
}

