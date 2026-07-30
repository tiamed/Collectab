import { describe, it, expect, vi } from 'vitest';
import { createTestApp, generateTestToken } from './helpers.js';

const mockSpaces: any[] = [];

vi.mock('../src/database/client.js', () => {
  const mockDb = {
    select: () => ({
      from: () => ({
        where: (condition: any) => ({
          orderBy: () => Promise.resolve(mockSpaces),
          then: (resolve: any) => resolve(mockSpaces.slice(0, 1)),
        }),
        then: (resolve: any) => resolve(mockSpaces),
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: () => {
          const newSpace = {
            id: 'space-' + Math.random().toString(36).slice(2, 8),
            ownerId: data.ownerId,
            name: data.name,
            icon: data.icon || '💼',
            orderIndex: data.orderIndex || 0,
            createdAt: new Date(),
          };
          mockSpaces.push(newSpace);
          return Promise.resolve([newSpace]);
        },
      }),
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...mockSpaces[0], ...data }]),
        }),
      }),
    }),
    delete: (table: any) => ({
      where: () => Promise.resolve(),
    }),
  };

  return { getDb: () => mockDb };
});

describe('Spaces routes', () => {
  const app = createTestApp();
  const token = generateTestToken('user-123');
  const authHeader = { Authorization: `Bearer ${token}` };

  describe('GET /api/spaces', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/api/spaces');
      expect(res.status).toBe(401);
    });

    it('returns spaces for authenticated user', async () => {
      const res = await app.request('/api/spaces', { headers: authHeader });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('spaces');
      expect(Array.isArray(body.spaces)).toBe(true);
    });
  });

  describe('POST /api/spaces', () => {
    it('rejects missing name', async () => {
      const res = await app.request('/api/spaces', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('creates a space with valid data', async () => {
      const res = await app.request('/api/spaces', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Work', icon: '💼' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.space).toHaveProperty('id');
      expect(body.space.name).toBe('Work');
    });
  });

  describe('PUT /api/spaces/:id', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/api/spaces/some-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/spaces/:id', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/api/spaces/some-id', { method: 'DELETE' });
      expect(res.status).toBe(401);
    });
  });
});
