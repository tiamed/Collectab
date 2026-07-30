import { describe, it, expect, vi } from 'vitest';
import { createTestApp, generateTestToken } from './helpers.js';

vi.mock('../src/database/client.js', () => {
  const mockCollections: any[] = [];

  const mockDb = {
    select: () => ({
      from: () => ({
        where: (condition: any) => ({
          orderBy: () => Promise.resolve(mockCollections),
          then: (resolve: any) => resolve(mockCollections.slice(0, 1)),
        }),
        then: (resolve: any) => resolve(mockCollections),
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: () => {
          const newCol = {
            id: 'col-' + Math.random().toString(36).slice(2, 8),
            spaceId: data.spaceId,
            ownerId: data.ownerId,
            name: data.name,
            icon: data.icon || '📁',
            color: data.color || '#3b82f6',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockCollections.push(newCol);
          return Promise.resolve([newCol]);
        },
      }),
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...mockCollections[0], ...data }]),
        }),
      }),
    }),
    delete: (table: any) => ({
      where: () => Promise.resolve(),
    }),
  };

  return { getDb: () => mockDb };
});

describe('Collections routes', () => {
  const app = createTestApp();
  const token = generateTestToken('user-123');
  const authHeader = { Authorization: `Bearer ${token}` };

  describe('GET /api/collections', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/api/collections');
      expect(res.status).toBe(401);
    });

    it('returns collections for authenticated user', async () => {
      const res = await app.request('/api/collections', { headers: authHeader });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('collections');
      expect(Array.isArray(body.collections)).toBe(true);
    });

    it('accepts spaceId filter', async () => {
      const res = await app.request('/api/collections?spaceId=abc-123', { headers: authHeader });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/collections', () => {
    it('rejects missing spaceId', async () => {
      const res = await app.request('/api/collections', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing name', async () => {
      const res = await app.request('/api/collections', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      expect(res.status).toBe(400);
    });

    it('creates collection with valid data', async () => {
      const res = await app.request('/api/collections', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Frontend',
          icon: '🎨',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.collection.name).toBe('Frontend');
      expect(body.collection.icon).toBe('🎨');
    });
  });
});
