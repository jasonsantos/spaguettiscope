import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SpascoConfigSchema, type SpascoConfig } from './schema.ts';

const CONFIG_FILENAME = 'spaguettiscope.config.json';

export async function loadConfig(projectRoot: string): Promise<SpascoConfig> {
  const configPath = join(projectRoot, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return SpascoConfigSchema.parse({});
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    throw new Error(`Failed to parse ${CONFIG_FILENAME}: invalid JSON`);
  }

  const result = SpascoConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid ${CONFIG_FILENAME}:\n${issues}`);
  }

  return result.data;
}
