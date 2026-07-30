import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../src/api/middleware/auth.js';

describe('Auth middleware', () => {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.get('/protected', (c) => c.json({ userId: c.get('userId') }));

  it('rejects requests without Authorization header', async () => {
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain('Missing');
  });

  it('rejects requests with non-Bearer scheme', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: 'Basic dGVzdDp0ZXN0' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const expiredToken = jwt.sign(
      { sub: 'user-1', email: 'test@test.com' },
      process.env.JWT_SECRET!,
      { expiresIn: -10 },
    );
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain('expired');
  });

  it('rejects tokens signed with wrong secret', async () => {
    const badToken = jwt.sign(
      { sub: 'user-1', email: 'test@test.com' },
      'wrong-secret-key-wrong-secret-key',
      { expiresIn: 900 },
    );
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${badToken}` },
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain('Invalid');
  });

  it('passes valid tokens and sets userId', async () => {
    const validToken = jwt.sign(
      { sub: 'user-42', email: 'valid@test.com' },
      process.env.JWT_SECRET!,
      { expiresIn: 900 },
    );
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-42');
  });
});
