import { minimatch } from 'minimatch';
import { inferDomainFromPath } from './built-in/domain.js';
import type { DimensionDefinition, DimensionSet } from './model.js';

export class InferenceEngine {
  constructor(
    private readonly definitions: DimensionDefinition[],
    private readonly projectRoot: string = process.cwd()
  ) {}

  infer(absoluteFilePath: string): DimensionSet {
    const relativePath = absoluteFilePath.startsWith(this.projectRoot + '/')
      ? absoluteFilePath.slice(this.projectRoot.length + 1)
      : absoluteFilePath;

    const result: DimensionSet = {};

    for (const definition of this.definitions) {
      // Domain uses structural inference instead of globs
      if (definition.name === 'domain') {
        const inferred = inferDomainFromPath(relativePath);
        if (inferred !== undefined) result.domain = inferred;
        continue;
      }

      const matched = definition.patterns.find(pattern =>
        pattern.globs.some(glob =>
          minimatch(relativePath, glob, { matchBase: false, dot: true })
        )
      );

      if (matched) {
        result[definition.name] = matched.value;
      } else if (definition.fallback !== undefined) {
        result[definition.name] = definition.fallback;
      }
    }

    return result;
  }
}
