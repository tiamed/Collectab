import { describe, it, expect } from 'vitest';
import { createTestApp } from './helpers.js';

describe('Health endpoint', () => {
  const app = createTestApp();

  it('GET /health returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
