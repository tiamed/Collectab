import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestApp, generateTestToken } from './helpers.js';

// Mock the database module
vi.mock('../src/database/client.js', () => {
  const users: any[] = [];

  const mockDb = {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => {
          // Simple mock: return matching user or empty
          return Promise.resolve(users.filter(() => true).slice(0, 1));
        },
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: (cols?: any) => {
          const newUser = {
            id: 'test-user-id-123',
            email: data.email,
            name: data.name,
            passwordHash: data.passwordHash,
            avatarUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          users.push(newUser);
          if (cols) {
            const projected: any = {};
            for (const [key] of Object.entries(cols)) {
              projected[key] = (newUser as any)[key];
            }
            return Promise.resolve([projected]);
          }
          return Promise.resolve([newUser]);
        },
      }),
    }),
  };

  return {
    getDb: () => mockDb,
  };
});

describe('Auth routes', () => {
  const app = createTestApp();

  describe('POST /api/auth/register', () => {
    it('rejects invalid email', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: '12345678', name: 'Test' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects short password', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: '123', name: 'Test' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing name', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: '12345678' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects invalid email format', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad', password: 'password123' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing password', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rejects missing refresh token', async () => {
      const res = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid refresh token', async () => {
      const res = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'garbage-token' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('rejects requests without token', async () => {
      const res = await app.request('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects requests with invalid token', async () => {
      const res = await app.request('/api/auth/me', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(res.status).toBe(401);
    });
  });
});
