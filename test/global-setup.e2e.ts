import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const STATE_FILE = join(__dirname, '.e2e-state.json');

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';

  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('testdb')
    .withUsername('test')
    .withPassword('test')
    .start();

  const databaseUrl = postgres.getConnectionUri();

  process.env.DATABASE_URL = databaseUrl;

  process.env.JWT_SECRET ??= 'e2e-test-jwt-secret-key-min-32-chars!!';
  process.env.JWT_EXPIRES_ACCESS_TOKEN ??= '15m';
  process.env.JWT_EXPIRES_REFRESH_TOKEN ??= '7d';
  process.env.COOKIES_DOMAIN ??= 'localhost';

  writeFileSync(
    STATE_FILE,
    JSON.stringify({
      postgresContainerId: postgres.getId(),
    }),
  );

  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
