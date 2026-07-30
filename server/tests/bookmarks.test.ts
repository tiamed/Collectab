import { describe, it, expect, vi } from 'vitest';
import { createTestApp, generateTestToken } from './helpers.js';

vi.mock('../src/database/client.js', () => {
  const mockBookmarks: any[] = [];
  const mockCollection = {
    id: 'col-abc',
    spaceId: 'space-1',
    ownerId: 'user-123',
    name: 'Test Col',
    icon: '📁',
    color: '#3b82f6',
    orderIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let selectCallCount = 0;

  const mockDb = {
    select: (cols?: any) => {
      selectCallCount++;
      return {
        from: (table: any) => ({
          where: (condition: any) => {
            // The bookmarks route does multiple selects:
            // 1st: collection ownership check -> return collection
            // 2nd: max order or bookmark lookup -> return bookmark data
            const result = {
              orderBy: () => Promise.resolve(mockBookmarks),
              then: undefined as any,
            };
            // Make it thenable to support await without .orderBy()
            result.then = (resolve: any) => resolve([mockCollection]);
            return result;
          },
        }),
      };
    },
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: () => {
          if (Array.isArray(data)) {
            const results = data.map((d: any, i: number) => ({
              id: `bm-${i}`,
              ...d,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
            mockBookmarks.push(...results);
            return Promise.resolve(results);
          }
          const newBm = {
            id: 'bm-' + Math.random().toString(36).slice(2, 8),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockBookmarks.push(newBm);
          return Promise.resolve([newBm]);
        },
      }),
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...mockBookmarks[0], ...data }]),
        }),
      }),
    }),
    delete: (table: any) => ({
      where: () => Promise.resolve(),
    }),
    execute: () => Promise.resolve({ rows: [] }),
  };

  return { getDb: () => mockDb };
});

describe('Bookmarks routes', () => {
  const app = createTestApp();
  const token = generateTestToken('user-123');
  const authHeader = { Authorization: `Bearer ${token}` };

  describe('GET /api/bookmarks', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/api/bookmarks?collectionId=550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(401);
    });

    it('requires collectionId param', async () => {
      const res = await app.request('/api/bookmarks', { headers: authHeader });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('collectionId');
    });

    it('returns bookmarks for valid collection', async () => {
      const res = await app.request('/api/bookmarks?collectionId=550e8400-e29b-41d4-a716-446655440000', {
        headers: authHeader,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('bookmarks');
    });
  });

  describe('POST /api/bookmarks', () => {
    it('rejects invalid URL', async () => {
      const res = await app.request('/api/bookmarks', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Test',
          url: 'not-a-url',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing title', async () => {
      const res = await app.request('/api/bookmarks', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: '550e8400-e29b-41d4-a716-446655440000',
          url: 'https://example.com',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('creates bookmark with valid data', async () => {
      const res = await app.request('/api/bookmarks', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Example',
          url: 'https://example.com',
          tags: ['test'],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.bookmark.title).toBe('Example');
      expect(body.bookmark.url).toBe('https://example.com');
    });
  });

  describe('POST /api/bookmarks/batch', () => {
    it('creates multiple bookmarks', async () => {
      const res = await app.request('/api/bookmarks/batch', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: '550e8400-e29b-41d4-a716-446655440000',
          bookmarks: [
            { title: 'GitHub', url: 'https://github.com' },
            { title: 'Google', url: 'https://google.com' },
          ],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.bookmarks).toHaveLength(2);
    });

    it('rejects invalid bookmark in batch', async () => {
      const res = await app.request('/api/bookmarks/batch', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: '550e8400-e29b-41d4-a716-446655440000',
          bookmarks: [{ title: 'Bad', url: 'not-valid' }],
        }),
      });
      expect(res.status).toBe(400);
    });
  });
});
