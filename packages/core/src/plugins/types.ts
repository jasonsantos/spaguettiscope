import type { Rule } from '../rules/types.js'

export interface ScanPlugin {
  id: string
  /** Return true if this plugin applies to the given package root. Synchronous. */
  canApply(packageRoot: string): boolean
  /** Return rules with paths relative to the package root (not the project root). */
  rules(): Rule[]
}
