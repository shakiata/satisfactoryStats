/**
 * Tests for the FRM API client — URL construction, headers, and connection testing.
 * Mocks global fetch to avoid real network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildUrl,
  fetchEndpoint,
  testConnection,
  sendChatMessage,
  getEndpoints,
  getEndpointsByCategory,
} from '../api';
import type { FRMConfig } from '../types';

// ─── Helpers ────────────────────────────────────────────────────

/** Create a minimal FRMConfig with overrides. */
function makeConfig(overrides: Partial<FRMConfig> = {}): FRMConfig {
  return {
    host: 'localhost',
    port: '8080',
    password: '',
    refreshRate: 5000,
    ...overrides,
  };
}

// ─── buildUrl ───────────────────────────────────────────────────

describe('buildUrl', () => {
  it('constructs a localhost URL with port', () => {
    const url = buildUrl(makeConfig(), 'getPower');
    expect(url).toBe('http://localhost:8080/getPower');
  });

  it('constructs a 127.0.0.1 URL with port', () => {
    const url = buildUrl(makeConfig({ host: '127.0.0.1' }), 'getTrains');
    expect(url).toBe('http://127.0.0.1:8080/getTrains');
  });

  it('constructs LAN IP URLs with port', () => {
    expect(buildUrl(makeConfig({ host: '192.168.1.50' }), 'getPower'))
      .toBe('http://192.168.1.50:8080/getPower');
    expect(buildUrl(makeConfig({ host: '10.0.0.5' }), 'getPower'))
      .toBe('http://10.0.0.5:8080/getPower');
    expect(buildUrl(makeConfig({ host: '172.16.0.1' }), 'getPower'))
      .toBe('http://172.16.0.1:8080/getPower');
  });

  it('uses HTTPS for domain names (ngrok, Cloudflare, etc.)', () => {
    const url = buildUrl(makeConfig({ host: 'abc.ngrok-free.app' }), 'getPower');
    expect(url).toBe('https://abc.ngrok-free.app/getPower');
  });

  it('strips port for domain-based hosts (tunnels handle port mapping)', () => {
    const url = buildUrl(
      makeConfig({ host: 'myserver.example.com', port: '8080' }),
      'getPower',
    );
    expect(url).toBe('https://myserver.example.com/getPower');
  });

  it('strips http:// scheme if user pastes it', () => {
    const url = buildUrl(makeConfig({ host: 'http://localhost' }), 'getPower');
    expect(url).toBe('http://localhost:8080/getPower');
  });

  it('strips https:// scheme if user pastes it', () => {
    const url = buildUrl(
      makeConfig({ host: 'https://abc.ngrok-free.app' }),
      'getPower',
    );
    expect(url).toBe('https://abc.ngrok-free.app/getPower');
  });

  it('strips trailing slashes from host', () => {
    const url = buildUrl(makeConfig({ host: 'localhost///' }), 'getPower');
    expect(url).toBe('http://localhost:8080/getPower');
  });

  it('strips embedded port from host (e.g., host:8080)', () => {
    const url = buildUrl(makeConfig({ host: 'localhost:3000', port: '8080' }), 'getPower');
    expect(url).toBe('http://localhost:8080/getPower');
  });

  it('falls back to localhost:8080 when host and port are empty', () => {
    const url = buildUrl(makeConfig({ host: '', port: '' }), 'getPower');
    expect(url).toBe('http://localhost:8080/getPower');
  });

  it('does not append port when port is 80 for localhost', () => {
    const url = buildUrl(makeConfig({ port: '80' }), 'getPower');
    expect(url).toBe('http://localhost/getPower');
  });

  it('does not append port when port is 443 for localhost', () => {
    const url = buildUrl(makeConfig({ port: '443' }), 'getPower');
    expect(url).toBe('http://localhost/getPower');
  });
});

// ─── fetchEndpoint ──────────────────────────────────────────────

describe('fetchEndpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches JSON from the constructed URL', async () => {
    const mockData = { circuits: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await fetchEndpoint(makeConfig(), 'getPower');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/getPower',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('sets Accept: application/json header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );

    await fetchEndpoint(makeConfig(), 'getPower');
    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.headers.Accept).toBe('application/json');
  });

  it('sends X-FRM-Authorization header when password is set', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );

    await fetchEndpoint(makeConfig({ password: 'secret123' }), 'getPower');
    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.headers['X-FRM-Authorization']).toBe('secret123');
  });

  it('does not send X-FRM-Authorization when password is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );

    await fetchEndpoint(makeConfig({ password: '' }), 'getPower');
    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.headers['X-FRM-Authorization']).toBeUndefined();
  });

  it('sends ngrok-skip-browser-warning for ngrok hosts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );

    await fetchEndpoint(
      makeConfig({ host: 'myapp.ngrok-free.app' }),
      'getPower',
    );
    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.headers['ngrok-skip-browser-warning']).toBe('1');
  });

  it('does not send ngrok header for localhost', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );

    await fetchEndpoint(makeConfig(), 'getPower');
    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.headers['ngrok-skip-browser-warning']).toBeUndefined();
  });

  it('throws on non-OK HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(fetchEndpoint(makeConfig(), 'getPower')).rejects.toThrow(
      'FRM API error: 404 Not Found',
    );
  });
});

// ─── testConnection ─────────────────────────────────────────────

describe('testConnection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok: true on successful connection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('[]', { status: 200 }),
    );

    const result = await testConnection(makeConfig());
    expect(result).toEqual({ ok: true });
  });

  it('returns ok: false with error message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error'),
    );

    const result = await testConnection(makeConfig());
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('handles non-Error throws (edge case)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('string error');

    const result = await testConnection(makeConfig());
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Unknown error');
  });
});

// ─── sendChatMessage ────────────────────────────────────────────

describe('sendChatMessage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs message to the chat endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );

    await sendChatMessage(makeConfig(), 'Hello world');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/sendChatMessage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'Hello world' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(
      sendChatMessage(makeConfig(), 'test'),
    ).rejects.toThrow('Chat send failed: 500 Internal Server Error');
  });
});

// ─── getEndpoints / getEndpointsByCategory ──────────────────────

describe('getEndpoints', () => {
  it('returns a non-empty array of endpoints', () => {
    const endpoints = getEndpoints();
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it('every endpoint has required fields', () => {
    for (const ep of getEndpoints()) {
      expect(ep).toHaveProperty('path');
      expect(ep).toHaveProperty('category');
      expect(ep).toHaveProperty('description');
      expect(ep).toHaveProperty('requiresGameThread');
      expect(typeof ep.path).toBe('string');
      expect(typeof ep.category).toBe('string');
      expect(typeof ep.description).toBe('string');
      expect(typeof ep.requiresGameThread).toBe('boolean');
    }
  });
});

describe('getEndpointsByCategory', () => {
  it('groups endpoints into categories', () => {
    const map = getEndpointsByCategory();
    expect(map.size).toBeGreaterThan(0);

    // Verify at least one endpoint per expected category
    const expectedCategories = ['power', 'generators', 'factory', 'transport'];
    for (const cat of expectedCategories) {
      expect(map.has(cat)).toBe(true);
      const eps = map.get(cat)!;
      expect(eps.length).toBeGreaterThan(0);
    }
  });

  it('all endpoints across categories match the flat list count', () => {
    const flat = getEndpoints();
    const map = getEndpointsByCategory();
    let count = 0;
    for (const [, eps] of map) {
      count += eps.length;
    }
    expect(count).toBe(flat.length);
  });
});
