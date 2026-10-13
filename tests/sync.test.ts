import { describe, expect, it } from 'vitest';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(run: (repo: string, app: string) => void) {
  const temp = mkdtempSync(join(tmpdir(), 'resboost-sync-test-'));
  const repo = join(temp, 'MCP');
  const app = join(temp, 'Resboost');
  try {
    cpSync('src', join(repo, 'src'), { recursive: true });
    cpSync('src', join(app, 'src'), { recursive: true });
    cpSync('scripts', join(repo, 'scripts'), { recursive: true });
    for (const file of ['server.json', 'package.json']) cpSync(file, join(repo, file));
    run(repo, app);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
function sync(repo: string, app?: string) {
  return spawnSync('bash', [join(repo, 'scripts/sync-from-resboost.sh'), ...(app ? [app] : [])], { cwd: resolve('.'), encoding: 'utf8' });
}
describe('source sync', () => {
  it('uses the correct default app directory and installs a validated snapshot', () => fixture((repo, app) => {
    const file = 'src/lib/property/constants.ts';
    writeFileSync(join(app, file), readFileSync(join(app, file), 'utf8') + '\n// Updated public source\n');
    const result = sync(repo);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(repo, file), 'utf8')).toContain('Updated public source');
  }));
  it('preserves the old snapshot if an allowlisted file is missing', () => fixture((repo, app) => {
    const file = 'src/server/mcp/server.ts';
    const before = readFileSync(join(repo, file), 'utf8');
    unlinkSync(join(app, 'src/lib/property/ids.ts'));
    expect(sync(repo, app).status).not.toBe(0);
    expect(readFileSync(join(repo, file), 'utf8')).toBe(before);
    expect(existsSync(join(repo, 'src/lib/property/ids.ts'))).toBe(true);
  }));
  it('rejects private content without installing or printing the matched value', () => fixture((repo, app) => {
    const file = 'src/server/mcp/server.ts';
    const before = readFileSync(join(repo, file), 'utf8');
    const secret = 'SECRET = "do-not-print-this-value"';
    writeFileSync(join(app, file), before + '\n// ' + secret + '\n');
    const result = sync(repo, app);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).not.toContain('do-not-print-this-value');
    expect(readFileSync(join(repo, file), 'utf8')).toBe(before);
  }));
});
