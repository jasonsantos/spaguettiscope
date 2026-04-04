export type DimensionName = string;
export type DimensionValue = string;

/** A set of named dimension values assigned to a file or test record. */
export type DimensionSet = Record<DimensionName, DimensionValue>;

/** One entry in a dimension's pattern list: a value and the globs that map to it. */
export interface DimensionPattern {
  value: DimensionValue;
  /** minimatch glob patterns, matched against the relative file path */
  globs: string[];
}

/** Full definition of one dimension — name, how to infer it, and an optional fallback value. */
export interface DimensionDefinition {
  name: DimensionName;
  patterns: DimensionPattern[];
  /** Assigned when no pattern matches. Omit to leave the dimension unset for unmatched files. */
  fallback?: DimensionValue;
}

export const BUILT_IN_DIMENSION_NAMES = ['role', 'domain', 'package'] as const;
export type BuiltInDimensionName = (typeof BUILT_IN_DIMENSION_NAMES)[number];

/** A user-configured rule mapping a glob pattern to a dimension value. */
export interface InferenceRule {
  glob: string
  value: string
}
