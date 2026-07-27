import { execSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const STATE_FILE = join(__dirname, '.e2e-state.json');

export default async function globalTeardown() {
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as {
      postgresContainerId: string;
    };

    execSync(`docker stop ${state.postgresContainerId}`, {
      stdio: 'ignore',
    });

    unlinkSync(STATE_FILE);
  } catch {
    // Containers may already be stopped if the run was interrupted.
  }
}
