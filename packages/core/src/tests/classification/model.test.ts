import { describe, it, expect } from 'vitest';
import { roleDimension, domainDimension, packageDimension, defaultDefinitions } from '../../classification/built-in/index.js';

describe('built-in dimension definitions', () => {
  it('role dimension has a name of "role"', () => {
    expect(roleDimension.name).toBe('role');
  });

  it('role dimension has patterns for repository', () => {
    const repoPattern = roleDimension.patterns.find(p => p.value === 'repository');
    expect(repoPattern).toBeDefined();
    expect(repoPattern!.globs.length).toBeGreaterThan(0);
  });

  it('domain dimension has a name of "domain"', () => {
    expect(domainDimension.name).toBe('domain');
  });

  it('package dimension has a name of "package"', () => {
    expect(packageDimension.name).toBe('package');
  });

  it('defaultDefinitions includes all three built-in dimensions', () => {
    const names = defaultDefinitions.map(d => d.name);
    expect(names).toContain('role');
    expect(names).toContain('domain');
    expect(names).toContain('package');
  });
});
