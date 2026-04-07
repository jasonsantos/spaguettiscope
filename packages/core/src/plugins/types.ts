import type { Rule } from '../rules/types.js'

export interface ScanPlugin {
  id: string
  /** Return true if this plugin applies to the given package root. Synchronous. */
  canApply(packageRoot: string): boolean
  /** Return rules with paths relative to the package root (not the project root). */
  rules(): Rule[]
  /**
   * Optional — declare the package type for any package where canApply() returns true.
   *
   * Returned value is a key into the renderer's icon registry. Built-in values:
   *   'library' | 'webapp' | 'nextjs' | 'react' | 'electron' | 'storybook' |
   *   'playwright' | 'api' | 'cli' | 'database' | 'drizzle' | 'prisma'
   *
   * The `spasco dashboard` command collects these into `summary.packageTypes`
   * (Record<pkgName, type>) so the browser renderer can look up the icon without
   * re-running plugin code at render time.
   *
   * If omitted, the renderer falls back to a connector-based heuristic and then
   * defaults to 'library'.
   */
  packageType?(): string
}
