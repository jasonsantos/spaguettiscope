import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InferenceEngine } from '../../classification/inference.js';
import { defaultDefinitions } from '../../classification/built-in/index.js';

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

describe('InferenceEngine — package.json walking', () => {
  let root: string

  beforeAll(() => {
    root = join(tmpdir(), `spasco-pkg-test-${Date.now()}`)
    // root package
    mkdirSync(join(root), { recursive: true })
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@test/root' }))
    // web app package
    mkdirSync(join(root, 'apps', 'web', 'src', 'components'), { recursive: true })
    writeFileSync(join(root, 'apps', 'web', 'package.json'), JSON.stringify({ name: '@test/web' }))
    // ui package
    mkdirSync(join(root, 'packages', 'ui', 'src'), { recursive: true })
    writeFileSync(
      join(root, 'packages', 'ui', 'package.json'),
      JSON.stringify({ name: '@test/ui' })
    )
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('infers package from nearest package.json', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'apps', 'web', 'src', 'components', 'Button.test.tsx'))
    expect(result.package).toBe('@test/web')
  })

  it('infers package for a deeply nested file', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'packages', 'ui', 'src', 'index.ts'))
    expect(result.package).toBe('@test/ui')
  })

  it('falls back to root package.json for files not in a subpackage', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'some-script.ts'))
    expect(result.package).toBe('@test/root')
  })
})

describe('InferenceEngine — Next.js App Router domain', () => {
  let root: string

  beforeAll(() => {
    root = join(tmpdir(), `spasco-nextjs-test-${Date.now()}`)
    const appDir = join(root, 'apps', 'web')
    // Create next.config.mjs alongside app/
    mkdirSync(join(appDir, 'app', 'checkout', 'payment'), { recursive: true })
    mkdirSync(join(appDir, 'app', '(auth)', 'login'), { recursive: true })
    mkdirSync(join(appDir, 'app', '(admin)', 'orders'), { recursive: true })
    mkdirSync(join(appDir, 'app', 'api', 'webhooks'), { recursive: true })
    writeFileSync(join(appDir, 'next.config.mjs'), 'export default {}')
    writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: '@test/web' }))
    // Also create a non-Next.js package (no next.config.mjs)
    mkdirSync(join(root, 'packages', 'ui', 'src'), { recursive: true })
    writeFileSync(
      join(root, 'packages', 'ui', 'package.json'),
      JSON.stringify({ name: '@test/ui' })
    )
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('infers domain from App Router top-level segment', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'apps', 'web', 'app', 'checkout', 'payment', 'page.tsx'))
    expect(result.domain).toBe('checkout')
  })

  it('skips route groups when extracting domain', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'apps', 'web', 'app', '(auth)', 'login', 'page.tsx'))
    expect(result.domain).toBe('login')
  })

  it('infers domain=api for api routes', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'apps', 'web', 'app', 'api', 'webhooks', 'route.ts'))
    expect(result.domain).toBe('api')
  })

  it('leaves domain unset for files outside app/ in a Next.js project', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'apps', 'web', 'lib', 'utils.ts'))
    expect(result.domain).toBeUndefined()
  })

  it('leaves domain unset for files in a non-Next.js package', () => {
    const engine = new InferenceEngine(defaultDefinitions, root)
    const result = engine.infer(join(root, 'packages', 'ui', 'src', 'Button.tsx'))
    expect(result.domain).toBeUndefined()
  })
})
