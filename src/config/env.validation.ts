import { parseEnvConfig } from './env.schema';

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const parsed = parseEnvConfig(config);

  return {
    ...config,
    ...parsed,
  };
}
