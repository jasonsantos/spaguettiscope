/**
 * SpaguettiScope NextJS Plugin
 * Provides NextJS-specific knowledge to the core analysis engine
 */

import { AnalyzerPlugin } from '@spaguettiscope/core'
import { glob } from 'glob'
import { readFileSync, existsSync } from 'fs'
import { join, relative, dirname, basename } from 'path'

export class NextJSPlugin extends AnalyzerPlugin {
  constructor() {
    super('nextjs')
  }

  /**
   * Check if this plugin can analyze the given project
   */
  async canAnalyze(projectPath) {
    // Check for Next.js indicators
    const indicators = [
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
      'package.json',
    ]

    for (const indicator of indicators) {
      const filePath = join(projectPath, indicator)
      if (existsSync(filePath)) {
        if (indicator === 'package.json') {
          try {
            const packageJson = JSON.parse(readFileSync(filePath, 'utf8'))
            return !!(
              packageJson.dependencies?.next ||
              packageJson.devDependencies?.next
            )
          } catch {
            continue
          }
        } else {
          return true
        }
      }
    }

    // Check for Next.js directory structure
    const nextjsDirectories = ['app', 'pages', 'src/app', 'src/pages']
    for (const dir of nextjsDirectories) {
      if (existsSync(join(projectPath, dir))) {
        return true
      }
    }

    return false
  }

  /**
   * Get NextJS-specific file patterns
   */
  getFilePatterns() {
    return [
      '**/*.{js,jsx,ts,tsx}',
      '**/*.{css,scss,sass,less}',
      '**/*.{json,md,mdx}',
    ]
  }

  /**
   * Get NextJS-specific ignore patterns
   */
  getIgnorePatterns() {
    return [
      // Dependencies and build tools
      'node_modules/**',
      '.git/**',

      // Next.js specific
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',

      // Generated files
      'generated/**',
      '.generated/**',
      '__generated__/**',

      // Development and testing
      'coverage/**',
      '.nyc_output/**',
      '.turbo/**',

      // Deployment
      '.vercel/**',
      '.netlify/**',

      // Environment and config
      '.env*',

      // IDE and OS
      '.vscode/**',
      '.idea/**',
      '*.log',
      '.DS_Store',
      'Thumbs.db',

      // Storybook
      'storybook-static/**',
      '.storybook/build/**',

      // Temporary files
      'tmp/**',
      'temp/**',
      '.tmp/**',
      '.temp/**',
    ]
  }

  /**
   * Discover NextJS project structure
   */
  async discover(projectPath, _options = {}) {
    console.log('Discovering NextJS project structure...')

    const projectStructure = {
      files: [],
      dependencies: [],
      routes: [],
      components: [],
      metadata: {
        framework: 'nextjs',
        version: await this.getNextJSVersion(projectPath),
        routerType: await this.detectRouterType(projectPath),
        features: await this.detectFeatures(projectPath),
      },
    }

    // Discover routes
    projectStructure.routes = await this.discoverRoutes(projectPath)

    // Discover components
    projectStructure.components = await this.discoverComponents(projectPath)

    // Discover API routes
    const apiRoutes = await this.discoverApiRoutes(projectPath)
    projectStructure.routes.push(...apiRoutes)

    // Discover middleware
    const middleware = await this.discoverMiddleware(projectPath)
    if (middleware) {
      projectStructure.routes.push(middleware)
    }

    // Discover tests and stories
    const tests = await this.discoverTests(projectPath)
    const stories = await this.discoverStories(projectPath)

    projectStructure.metadata.testCoverage = this.calculateTestCoverage(
      projectStructure.components,
      tests
    )
    projectStructure.metadata.storyCoverage = this.calculateStoryCoverage(
      projectStructure.components,
      stories
    )

    return projectStructure
  }

  /**
   * Get NextJS version from package.json
   */
  async getNextJSVersion(projectPath) {
    try {
      const packageJsonPath = join(projectPath, 'package.json')
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
        return (
          packageJson.dependencies?.next ||
          packageJson.devDependencies?.next ||
          'unknown'
        )
      }
    } catch (error) {
      console.warn('Could not read package.json:', error.message)
    }
    return 'unknown'
  }

  /**
   * Detect router type (App Router vs Pages Router)
   */
  async detectRouterType(projectPath) {
    const appDir =
      existsSync(join(projectPath, 'app')) ||
      existsSync(join(projectPath, 'src/app'))
    const pagesDir =
      existsSync(join(projectPath, 'pages')) ||
      existsSync(join(projectPath, 'src/pages'))

    if (appDir && pagesDir) {
      return 'hybrid' // Both routers present
    } else if (appDir) {
      return 'app'
    } else if (pagesDir) {
      return 'pages'
    }

    return 'unknown'
  }

  /**
   * Detect NextJS features in use
   */
  async detectFeatures(projectPath) {
    const features = []

    // Check for common NextJS features
    const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts']
    for (const configFile of configFiles) {
      const configPath = join(projectPath, configFile)
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf8')
          if (content.includes('experimental')) {
            features.push('experimental-features')
          }
          if (content.includes('images')) {
            features.push('image-optimization')
          }
          if (content.includes('i18n')) {
            features.push('internationalization')
          }
          if (content.includes('rewrites')) {
            features.push('rewrites')
          }
          if (content.includes('redirects')) {
            features.push('redirects')
          }
        } catch {
          // Ignore parsing errors
        }
        break
      }
    }

    // Check for TypeScript
    if (existsSync(join(projectPath, 'tsconfig.json'))) {
      features.push('typescript')
    }

    // Check for Tailwind CSS
    if (
      existsSync(join(projectPath, 'tailwind.config.js')) ||
      existsSync(join(projectPath, 'tailwind.config.ts'))
    ) {
      features.push('tailwindcss')
    }

    return features
  }

  /**
   * Discover NextJS routes
   */
  async discoverRoutes(projectPath) {
    const routes = []

    // App Router routes
    const appRoutes = await this.discoverAppRoutes(projectPath)
    routes.push(...appRoutes)

    // Pages Router routes
    const pageRoutes = await this.discoverPageRoutes(projectPath)
    routes.push(...pageRoutes)

    return routes
  }

  /**
   * Discover App Router routes (app directory)
   */
  async discoverAppRoutes(projectPath) {
    const routes = []
    const appDirs = ['app', 'src/app']

    for (const appDir of appDirs) {
      const fullAppDir = join(projectPath, appDir)
      if (!existsSync(fullAppDir)) {
        continue
      }

      // Find page.* files
      const pageFiles = await glob('**/page.{js,jsx,ts,tsx}', {
        cwd: fullAppDir,
        absolute: true,
      })

      for (const pageFile of pageFiles) {
        const relativePath = relative(fullAppDir, pageFile)
        const routePath = this.convertAppRouteToPath(relativePath)
        const content = readFileSync(pageFile, 'utf8')

        routes.push({
          path: routePath,
          filePath: relative(projectPath, pageFile),
          type: 'app-page',
          dynamic: routePath.includes('[') && routePath.includes(']'),
          parallel: routePath.includes('@'),
          intercepting: routePath.includes('(.)'),
          isServer: this.isServerComponent(content),
          metadata: {
            hasLayout: await this.hasLayout(dirname(pageFile)),
            hasLoading: await this.hasLoading(dirname(pageFile)),
            hasError: await this.hasError(dirname(pageFile)),
            hasNotFound: await this.hasNotFound(dirname(pageFile)),
          },
        })
      }

      // Find layout.* files
      const layoutFiles = await glob('**/layout.{js,jsx,ts,tsx}', {
        cwd: fullAppDir,
        absolute: true,
      })

      for (const layoutFile of layoutFiles) {
        const relativePath = relative(fullAppDir, layoutFile)
        const routePath = this.convertAppRouteToPath(
          relativePath.replace('/layout', '')
        )
        const content = readFileSync(layoutFile, 'utf8')

        routes.push({
          path: routePath,
          filePath: relative(projectPath, layoutFile),
          type: 'app-layout',
          dynamic: false,
          isServer: this.isServerComponent(content),
          metadata: {},
        })
      }
    }

    return routes
  }

  /**
   * Discover Pages Router routes (pages directory)
   */
  async discoverPageRoutes(projectPath) {
    const routes = []
    const pagesDirs = ['pages', 'src/pages']

    for (const pagesDir of pagesDirs) {
      const fullPagesDir = join(projectPath, pagesDir)
      if (!existsSync(fullPagesDir)) {
        continue
      }

      const pageFiles = await glob('**/*.{js,jsx,ts,tsx}', {
        cwd: fullPagesDir,
        absolute: true,
      })

      for (const pageFile of pageFiles) {
        const relativePath = relative(fullPagesDir, pageFile)

        // Skip API routes (handled separately)
        if (relativePath.startsWith('api/')) {
          continue
        }

        // Skip special files
        if (
          ['_app', '_document', '_error', '404', '500'].some(special =>
            relativePath.includes(special)
          )
        ) {
          continue
        }

        const routePath = this.convertPageRouteToPath(relativePath)
        const content = readFileSync(pageFile, 'utf8')

        routes.push({
          path: routePath,
          filePath: relative(projectPath, pageFile),
          type: 'pages-page',
          dynamic: routePath.includes('[') && routePath.includes(']'),
          hasGetStaticProps: content.includes('getStaticProps'),
          hasGetServerSideProps: content.includes('getServerSideProps'),
          hasGetStaticPaths: content.includes('getStaticPaths'),
          metadata: {},
        })
      }
    }

    return routes
  }

  /**
   * Discover API routes
   */
  async discoverApiRoutes(projectPath) {
    const routes = []

    // App Router API routes
    const appApiRoutes = await this.discoverAppApiRoutes(projectPath)
    routes.push(...appApiRoutes)

    // Pages Router API routes
    const pagesApiRoutes = await this.discoverPagesApiRoutes(projectPath)
    routes.push(...pagesApiRoutes)

    return routes
  }

  /**
   * Discover App Router API routes
   */
  async discoverAppApiRoutes(projectPath) {
    const routes = []
    const appDirs = ['app', 'src/app']

    for (const appDir of appDirs) {
      const fullAppDir = join(projectPath, appDir)
      if (!existsSync(fullAppDir)) {
        continue
      }

      const routeFiles = await glob('**/route.{js,ts}', {
        cwd: fullAppDir,
        absolute: true,
      })

      for (const routeFile of routeFiles) {
        const relativePath = relative(fullAppDir, routeFile)
        const routePath = this.convertAppRouteToPath(relativePath)
        const content = readFileSync(routeFile, 'utf8')

        routes.push({
          path: routePath,
          filePath: relative(projectPath, routeFile),
          type: 'app-api',
          dynamic: routePath.includes('[') && routePath.includes(']'),
          methods: this.extractApiMethods(content),
          metadata: {},
        })
      }
    }

    return routes
  }

  /**
   * Discover Pages Router API routes
   */
  async discoverPagesApiRoutes(projectPath) {
    const routes = []
    const pagesDirs = ['pages', 'src/pages']

    for (const pagesDir of pagesDirs) {
      const fullPagesDir = join(projectPath, pagesDir)
      const apiDir = join(fullPagesDir, 'api')
      if (!existsSync(apiDir)) {
        continue
      }

      const apiFiles = await glob('**/*.{js,ts}', {
        cwd: apiDir,
        absolute: true,
      })

      for (const apiFile of apiFiles) {
        const relativePath = relative(apiDir, apiFile)
        const routePath = `/api/${this.convertPageRouteToPath(relativePath)}`
        const content = readFileSync(apiFile, 'utf8')

        routes.push({
          path: routePath,
          filePath: relative(projectPath, apiFile),
          type: 'pages-api',
          dynamic: routePath.includes('[') && routePath.includes(']'),
          methods: this.extractApiMethods(content),
          metadata: {},
        })
      }
    }

    return routes
  }

  /**
   * Discover middleware
   */
  async discoverMiddleware(projectPath) {
    const middlewareFiles = [
      'middleware.js',
      'middleware.ts',
      'src/middleware.js',
      'src/middleware.ts',
    ]

    for (const middlewareFile of middlewareFiles) {
      const fullPath = join(projectPath, middlewareFile)
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf8')

        return {
          path: '/middleware',
          filePath: middlewareFile,
          type: 'middleware',
          dynamic: false,
          matcher: this.extractMiddlewareMatcher(content),
          metadata: {},
        }
      }
    }

    return null
  }

  /**
   * Discover React components
   */
  async discoverComponents(projectPath) {
    const components = []
    const componentPatterns = [
      'components/**/*.{jsx,tsx}',
      'src/components/**/*.{jsx,tsx}',
      'lib/components/**/*.{jsx,tsx}',
      'ui/**/*.{jsx,tsx}',
      'src/ui/**/*.{jsx,tsx}',
    ]

    for (const pattern of componentPatterns) {
      const componentFiles = await glob(pattern, {
        cwd: projectPath,
        absolute: true,
      })

      for (const componentFile of componentFiles) {
        const content = readFileSync(componentFile, 'utf8')
        const relativePath = relative(projectPath, componentFile)

        components.push({
          name: this.extractComponentName(componentFile),
          path: relativePath,
          type: this.isServerComponent(content) ? 'server' : 'client',
          isHook: basename(componentFile).startsWith('use'),
          isUtility:
            relativePath.includes('util') || relativePath.includes('helper'),
          dependencies: this.extractComponentDependencies(content),
          metadata: {
            hasProps: content.includes('props'),
            hasState:
              content.includes('useState') || content.includes('useReducer'),
            hasEffects: content.includes('useEffect'),
            isForwardRef: content.includes('forwardRef'),
            isMemo: content.includes('memo'),
          },
        })
      }
    }

    return components
  }

  /**
   * Discover test files
   */
  async discoverTests(projectPath) {
    const testPatterns = [
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      'tests/**/*.{js,jsx,ts,tsx}',
    ]

    const tests = []

    for (const pattern of testPatterns) {
      const testFiles = await glob(pattern, {
        cwd: projectPath,
        absolute: true,
      })

      for (const testFile of testFiles) {
        const relativePath = relative(projectPath, testFile)
        const content = readFileSync(testFile, 'utf8')

        tests.push({
          path: relativePath,
          type: this.getTestType(relativePath, content),
          testedFile: this.inferTestedFile(relativePath),
          framework: this.detectTestFramework(content),
        })
      }
    }

    return tests
  }

  /**
   * Discover Storybook stories
   */
  async discoverStories(projectPath) {
    const storyPatterns = [
      '**/*.stories.{js,jsx,ts,tsx}',
      '**/*.story.{js,jsx,ts,tsx}',
    ]

    const stories = []

    for (const pattern of storyPatterns) {
      const storyFiles = await glob(pattern, {
        cwd: projectPath,
        absolute: true,
      })

      for (const storyFile of storyFiles) {
        const relativePath = relative(projectPath, storyFile)

        stories.push({
          path: relativePath,
          component: this.inferStoryComponent(relativePath),
        })
      }
    }

    return stories
  }

  // Helper methods

  /**
   * Convert App Router file path to route path
   */
  convertAppRouteToPath(filePath) {
    return `/${filePath
      .replace(/\/page\.(js|jsx|ts|tsx)$/, '')
      .replace(/\/layout\.(js|jsx|ts|tsx)$/, '')
      .replace(/\/route\.(js|ts)$/, '')
      .replace(/\\/g, '/')}`
  }

  /**
   * Convert Pages Router file path to route path
   */
  convertPageRouteToPath(filePath) {
    return `/${filePath
      .replace(/\.(js|jsx|ts|tsx)$/, '')
      .replace(/\/index$/, '')
      .replace(/\\/g, '/')}`
  }

  /**
   * Check if component is a server component
   */
  isServerComponent(content) {
    return (
      !content.includes('"use client"') && !content.includes("'use client'")
    )
  }

  /**
   * Extract API methods from route handler
   */
  extractApiMethods(content) {
    const methods = []
    const httpMethods = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'HEAD',
      'OPTIONS',
    ]

    for (const method of httpMethods) {
      if (
        content.includes(`export async function ${method}`) ||
        content.includes(`export function ${method}`)
      ) {
        methods.push(method)
      }
    }

    return methods
  }

  /**
   * Extract middleware matcher
   */
  extractMiddlewareMatcher(content) {
    const matcherMatch = content.match(/matcher:\s*['"`]([^'"`]+)['"`]/)
    return matcherMatch ? matcherMatch[1] : null
  }

  /**
   * Extract component name from file path
   */
  extractComponentName(filePath) {
    return basename(filePath).replace(/\.(jsx|tsx)$/, '')
  }

  /**
   * Extract component dependencies (simplified)
   */
  extractComponentDependencies(content) {
    const dependencies = []
    const importMatches = content.match(
      /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
    )

    if (importMatches) {
      for (const match of importMatches) {
        const moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/)
        if (moduleMatch) {
          dependencies.push(moduleMatch[1])
        }
      }
    }

    return dependencies
  }

  /**
   * Check for layout file in directory
   */
  async hasLayout(dirPath) {
    const layoutFiles = ['layout.js', 'layout.jsx', 'layout.ts', 'layout.tsx']
    return layoutFiles.some(file => existsSync(join(dirPath, file)))
  }

  /**
   * Check for loading file in directory
   */
  async hasLoading(dirPath) {
    const loadingFiles = [
      'loading.js',
      'loading.jsx',
      'loading.ts',
      'loading.tsx',
    ]
    return loadingFiles.some(file => existsSync(join(dirPath, file)))
  }

  /**
   * Check for error file in directory
   */
  async hasError(dirPath) {
    const errorFiles = ['error.js', 'error.jsx', 'error.ts', 'error.tsx']
    return errorFiles.some(file => existsSync(join(dirPath, file)))
  }

  /**
   * Check for not-found file in directory
   */
  async hasNotFound(dirPath) {
    const notFoundFiles = [
      'not-found.js',
      'not-found.jsx',
      'not-found.ts',
      'not-found.tsx',
    ]
    return notFoundFiles.some(file => existsSync(join(dirPath, file)))
  }

  /**
   * Get test type
   */
  getTestType(filePath, content) {
    if (
      filePath.includes('e2e') ||
      content.includes('playwright') ||
      content.includes('cypress')
    ) {
      return 'e2e'
    }
    if (filePath.includes('integration') || content.includes('render')) {
      return 'integration'
    }
    return 'unit'
  }

  /**
   * Infer tested file from test file path
   */
  inferTestedFile(testPath) {
    return testPath
      .replace(/\.(test|spec)\./, '.')
      .replace(/__tests__\//, '')
      .replace(/tests\//, '')
  }

  /**
   * Detect test framework
   */
  detectTestFramework(content) {
    if (content.includes('jest')) {
      return 'jest'
    }
    if (content.includes('vitest')) {
      return 'vitest'
    }
    if (content.includes('mocha')) {
      return 'mocha'
    }
    if (content.includes('playwright')) {
      return 'playwright'
    }
    if (content.includes('cypress')) {
      return 'cypress'
    }
    return 'unknown'
  }

  /**
   * Infer story component
   */
  inferStoryComponent(storyPath) {
    return storyPath
      .replace(/\.stories?\./, '.')
      .replace(/\.(js|jsx|ts|tsx)$/, '')
  }

  /**
   * Calculate test coverage
   */
  calculateTestCoverage(components, tests) {
    if (components.length === 0) {
      return 0
    }

    const testedComponents = components.filter(component =>
      tests.some(test => test.testedFile.includes(component.name))
    )

    return (testedComponents.length / components.length) * 100
  }

  /**
   * Calculate story coverage
   */
  calculateStoryCoverage(components, stories) {
    if (components.length === 0) {
      return 0
    }

    const storiedComponents = components.filter(component =>
      stories.some(story => story.component.includes(component.name))
    )

    return (storiedComponents.length / components.length) * 100
  }
}
