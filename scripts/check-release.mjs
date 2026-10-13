import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

const sourceArg = process.argv.indexOf('--source');
const source = resolve(sourceArg < 0 ? 'src' : process.argv[sourceArg + 1]);
// Defence in depth, not a substitute for reviewing the diff and scanning Git history.
const forbidden = /lonres\.dev|feeds_api|process\.env|API_KEY|SECRET|PASSWORD|AUTH_|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/i;
async function scan(dir) {
  for (const entry of await readdir(dir)) {
    const path = resolve(dir, entry);
    const stat = await lstat(path);
    assert(!stat.isSymbolicLink(), `Symlink refused: ${relative(source, path)}`);
    if (stat.isDirectory()) await scan(path);
    else {
      assert(path.endsWith('.ts'), `Unexpected source file: ${relative(source, path)}`);
      assert(!forbidden.test(await readFile(path, 'utf8')), `Private-content check failed: ${relative(source, path)}`);
    }
  }
}
await scan(source);
const card = JSON.parse(await readFile('server.json', 'utf8'));
const server = await readFile(resolve(source, 'server/mcp/server.ts'), 'utf8');
const version = /MCP_SERVER_VERSION = "([^"]+)"/.exec(server)?.[1];
assert.equal(card.version, version, 'Registry and handshake versions must match');
assert.equal(card.repository.url, 'https://github.com/ResBoost/MCP');
assert.deepEqual(card.remotes, [{ type: 'streamable-http', url: 'https://resboost.ai/api/mcp' }]);
assert.equal(JSON.parse(await readFile('package.json', 'utf8')).version, version);
if (sourceArg < 0) {
  const readme = await readFile('README.md', 'utf8');
  for (const document of ['README.md', 'assets/README.md']) {
    const contents = await readFile(document, 'utf8');
    const targets = [
      ...Array.from(contents.matchAll(/\]\(([^)]+)\)/g), match => match[1]),
      ...Array.from(contents.matchAll(/(?:src|srcset|href)\s*=\s*["']([^"']+)["']/g), match => match[1]),
    ];
    for (const target of targets) {
      // Root-relative HTML examples refer to the website, not this source snapshot.
      if (/^(?:https?:|#|\/)/.test(target)) continue;
      await lstat(resolve(dirname(document), target.split('#')[0]));
    }
  }
  assert(!readme.includes('github.com/LonRes/MCP'), 'README uses the old repository URL');
}
console.log('Public-source scan, release metadata and documentation checks passed.');
