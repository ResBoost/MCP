import { beforeEach, describe, expect, it } from 'vitest';
import { POST, GET, DELETE } from '../src/app/api/mcp/route';
import { registryServer } from '../src/server/mcp/discovery';
import { getProperty, searchProperties, logUpstreamError } from './stubs/service';
import { LonresApiError } from './stubs/client';
import type { PropertyDetail } from '../src/lib/property/types';
import { readFileSync } from 'node:fs';

const listing: PropertyDetail = {
  id: '123', address: 'Example Road, W9', description: 'A home supplied by the agent.',
  section: 'sales', availability: 'available', status: 'For Sale',
  price: { amount: 850000, display: null, qualifier: null, onApplication: false, period: null, currency: 'GBP' },
  facts: { bedrooms: 2, bathrooms: 1, receptions: 1, floorAreaSqFt: 800, propertyType: 'Flat', tenureType: 'Leasehold', tenure: '99 years', epcRating: 'C', parking: false, outsideSpace: true, lift: null },
  agent: { organisation: 'Example Estates', name: 'Agent', telephone: '020 1234 5678', telephoneE164: '+442012345678', email: 'agent@example.com', whatsappE164: null, logoUrl: null, officeAddress: 'Office Road', photoUrl: null, brand: null },
  photos: [], media: [], accommodation: null, postcode: 'W9 1AA', locality: 'London',
  closedOn: null, floor: null, groundRent: null, serviceCharge: null, furnished: null,
  dateAvailable: null, location: null, videoUrl: null, virtualTourUrl: null,
  notices: { about: null, disclaimer: null, capNotes: null },
};
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://resboost.ai/api/mcp', {
    method: 'POST',
    headers: { host: 'resboost.ai', 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
async function rpc(method: string, params?: unknown) {
  const response = await POST(request({ jsonrpc: '2.0', id: 1, method, params }));
  expect(response.status).toBe(200);
  return response.json();
}
beforeEach(() => {
  getProperty.mockReset(); searchProperties.mockReset(); logUpstreamError.mockClear();
  getProperty.mockResolvedValue(listing);
  searchProperties.mockResolvedValue({ items: [listing], capped: false, limit: 50 });
});
describe('real MCP transport with an isolated listing service', () => {
  it('initializes and discovers two tools with input/output schemas', async () => {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    expect(init.result.serverInfo.version).toBe('0.2.0');
    expect(init.result.protocolVersion).toBe('2025-06-18');
    const discovery = await rpc('tools/list');
    expect(discovery.result.tools.map((t: any) => t.name)).toEqual(['search_properties', 'get_property']);
    for (const tool of discovery.result.tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
    }
  });
  it('accepts initialized notifications without a response body', async () => {
    const response = await POST(request({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
  });
  it('returns text and structured search/detail results', async () => {
    const search = await rpc('tools/call', { name: 'search_properties', arguments: { postcodes: ['w9'], priceMax: 900000 } });
    expect(search.result.isError).not.toBe(true);
    expect(search.result.structuredContent.results[0].id).toBe('123');
    expect(search.result.structuredContent.resultCount).toBe(1);
    expect(searchProperties).toHaveBeenCalledWith(expect.objectContaining({ postcodes: ['W9'] }));
    const detail = await rpc('tools/call', { name: 'get_property', arguments: { id: '123' } });
    expect(detail.result.structuredContent.agent.email).toBe('agent@example.com');
    expect(detail.result.content[0].text).toContain('not verified');
  });
  it.each(['sold', 'let', 'withdrawn'] as const)('redacts %s contact details even when the service has not', async availability => {
    getProperty.mockResolvedValue({ ...listing, availability });
    const result = (await rpc('tools/call', { name: 'get_property', arguments: { id: '123' } })).result;
    expect(result.structuredContent.priceAmount).toBeNull();
    expect(result.structuredContent.agent.telephone).toBeNull();
    expect(result.structuredContent.agent.email).toBeNull();
    expect(result.content[0].text).not.toContain(listing.agent.email);
    expect(result.content[0].text).not.toContain('850,000');
  });
  it('rejects invalid tool inputs before calling the listing service', async () => {
    const result = await rpc('tools/call', { name: 'get_property', arguments: { id: '../../private' } });
    expect(result.result?.isError || result.error).toBeTruthy();
    expect(getProperty).not.toHaveBeenCalled();
    const search = await rpc('tools/call', { name: 'search_properties', arguments: { priceMax: -1 } });
    expect(search.result?.isError || search.error).toBeTruthy();
    expect(searchProperties).not.toHaveBeenCalled();
  });
  it('handles missing listings and hides upstream error details', async () => {
    getProperty.mockResolvedValue(null);
    expect((await rpc('tools/call', { name: 'get_property', arguments: { id: '123' } })).result.isError).toBe(true);
    searchProperties.mockRejectedValue(new LonresApiError('private upstream detail'));
    const error = (await rpc('tools/call', { name: 'search_properties', arguments: {} })).result;
    expect(error.isError).toBe(true);
    expect(error.content[0].text).not.toContain('private upstream detail');
    expect(logUpstreamError).toHaveBeenCalled();
  });
});
describe('request boundary', () => {
  it('rejects hostile origins and forged forwarded hosts', async () => {
    expect((await POST(request({}, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect((await POST(request({}, { host: 'attacker.example', 'x-forwarded-host': 'resboost.ai' }))).status).toBe(403);
    expect(getProperty).not.toHaveBeenCalled();
  });
  it('rejects invalid JSON, batches and unsupported protocol versions', async () => {
    expect((await POST(request('{'))).status).toBe(400);
    expect((await POST(request([]))).status).toBe(400);
    expect((await POST(request({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'mcp-protocol-version': 'not-supported' }))).status).toBe(400);
  });
  it('rejects declared oversized bodies before reading', async () => {
    expect((await POST(request('{}', { 'content-length': '65537' }))).status).toBe(413);
  });
  it('cancels chunked oversized bodies without consuming the remainder', async () => {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(40000)); },
      cancel() { cancelled = true; },
    });
    const req = new Request('https://resboost.ai/api/mcp', { method: 'POST', headers: { host: 'resboost.ai' }, body: stream, duplex: 'half' } as RequestInit);
    expect((await POST(req)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(3);
  });
  it('returns a client error when reading the body fails', async () => {
    const req = new Request('https://resboost.ai/api/mcp', { method: 'POST', headers: { host: 'resboost.ai' }, body: new ReadableStream({ start(c) { c.error(new Error('broken')); } }), duplex: 'half' } as RequestInit);
    expect((await POST(req)).status).toBe(400);
  });
  it('does not offer streaming GET or session DELETE', () => {
    for (const handler of [GET, DELETE]) {
      const response = handler();
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    }
  });
});
it('keeps generated registry metadata identical to the published file', () => {
  expect(registryServer()).toEqual(JSON.parse(readFileSync('server.json', 'utf8')));
});
