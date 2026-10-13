import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const registry = JSON.parse(await readFile(new URL('../server.json', import.meta.url), 'utf8'));
const endpoint = new URL(process.env.MCP_ENDPOINT ?? registry.remotes[0].url);
const client = new Client({ name: 'resboost-release-check', version: '1.0.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(endpoint), { timeout: 15000 });
  assert.equal(client.getServerVersion()?.version, registry.version);
  const { tools } = await client.listTools({}, { timeout: 15000 });
  assert.deepEqual(tools.map(t => t.name).sort(), ['get_property', 'search_properties']);
  assert(tools.every(t => t.annotations?.readOnlyHint && t.outputSchema));
  const search = await client.callTool({ name: 'search_properties', arguments: { postcodes: ['W9'], bedsMin: 2 } }, undefined, { timeout: 15000 });
  assert(!search.isError, 'Search returned a tool error');
  const results = search.structuredContent?.results;
  assert(Array.isArray(results), 'Missing structured search results');
  assert(results.length > 0, 'No sample listing found; verify detail manually before release');
  const detail = await client.callTool({ name: 'get_property', arguments: { id: results[0].id } }, undefined, { timeout: 15000 });
  assert(!detail.isError && detail.structuredContent?.id === results[0].id, 'Detail check failed');
  const response = await fetch(new URL('/.well-known/mcp/server.json', endpoint), { signal: AbortSignal.timeout(15000) });
  assert(response.ok, 'Registry endpoint unavailable');
  assert.deepEqual(await response.json(), registry, 'Live registry differs from server.json');
  console.log('Live handshake, tools, search, detail and registry checks passed.');
} catch (error) {
  if (error?.code === 404) {
    console.error(`Live MCP check failed: ${endpoint} returns HTTP 404. Deploy the MCP route before publishing connection instructions.`);
  } else {
    console.error('Live MCP check failed:', error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
} finally {
  await client.close();
}
