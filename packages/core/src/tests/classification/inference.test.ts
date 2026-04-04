import { describe, it, expect } from 'vitest';
import { InferenceEngine } from '../../classification/inference.ts';
import { defaultDefinitions } from '../../classification/built-in/index.ts';

describe('InferenceEngine', () => {
  const engine = new InferenceEngine(defaultDefinitions, '/project');

  it('infers role=repository from path', () => {
    const result = engine.infer('/project/src/repositories/userRepository.ts');
    expect(result.role).toBe('repository');
  });

  it('infers role=hook from useXxx file', () => {
    const result = engine.infer('/project/src/hooks/useAuth.ts');
    expect(result.role).toBe('hook');
  });

  it('infers role=test from test file', () => {
    const result = engine.infer('/project/src/components/Button.test.tsx');
    expect(result.role).toBe('test');
  });

  it('infers domain=admin from app/admin path', () => {
    const result = engine.infer('/project/app/admin/page.tsx');
    expect(result.domain).toBe('admin');
  });

  it('infers domain=auth from app/auth path', () => {
    const result = engine.infer('/project/app/auth/login/page.tsx');
    expect(result.domain).toBe('auth');
  });

  it('leaves domain unset for files outside named feature dirs', () => {
    const result = engine.infer('/project/src/lib/utils.ts');
    expect(result.domain).toBeUndefined();
  });

  it('falls back to role=unknown for unrecognized files', () => {
    const result = engine.infer('/project/random/file.ts');
    expect(result.role).toBe('unknown');
  });

  it('returns empty DimensionSet for an empty definitions list', () => {
    const emptyEngine = new InferenceEngine([], '/project');
    const result = emptyEngine.infer('/project/src/anything.ts');
    expect(result).toEqual({});
  });
});
