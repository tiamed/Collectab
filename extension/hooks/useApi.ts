import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@/lib/api';
import {
  ensureDataCacheLoaded,
  getCachedSpaces,
  setCachedSpaces,
  getCachedCollections,
  setCachedCollections,
  getCachedBookmarks,
  setCachedBookmarks,
} from '@/lib/dataCache';

export function useOrganizations(enabled = true) {
  const [orgs, setOrgs] = useState<api.Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await api.getOrganizations();
      setOrgs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { fetch(); }, [fetch]);

  return { orgs, loading, refetch: fetch };
}

export function useSpaces(orgId?: string | null, enabled = true) {
  const [spaces, setSpaces] = useState<api.Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = orgId || '__personal__';

  const fetch = useCallback(async () => {
    if (!enabled) return;

    await ensureDataCacheLoaded();
    const cached = getCachedSpaces(cacheKey);
    if (cached) {
      setSpaces(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const data = await api.getSpaces(orgId);
      setCachedSpaces(cacheKey, data);
      setSpaces(data);
    } catch (e: any) {
      setError(e.message);
      if (!cached) setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, enabled, cacheKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { spaces, loading, error, refetch: fetch };
}

export function useCollections(spaceId: string | null, enabled = true) {
  const [collections, setCollections] = useState<api.Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled || !spaceId) {
      setCollections([]);
      setLoading(false);
      return;
    }

    await ensureDataCacheLoaded();
    const cached = getCachedCollections(spaceId);
    if (cached) {
      setCollections(cached);
      setLoading(false);
    } else {
      setCollections([]);
      setLoading(true);
    }

    setError(null);
    try {
      const data = await api.getCollections(spaceId);
      setCachedCollections(spaceId, data);
      setCollections(data);
    } catch (e: any) {
      setError(e.message);
      if (!cached) setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [spaceId, enabled]);

  useEffect(() => { fetch(); }, [fetch]);

  return { collections, loading, error, refetch: fetch };
}

export function useBookmarks(collectionId: string | null) {
  const [bookmarks, setBookmarks] = useState<api.Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!collectionId) { setBookmarks([]); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBookmarks(collectionId);
      setBookmarks(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (params: Parameters<typeof api.createBookmark>[0]) => {
    const bookmark = await api.createBookmark(params);
    setBookmarks((prev) => [...prev, bookmark]);
    return bookmark;
  }, []);

  const update = useCallback(async (id: string, updates: Parameters<typeof api.updateBookmark>[1]) => {
    const bookmark = await api.updateBookmark(id, updates);
    setBookmarks((prev) => prev.map((b) => (b.id === id ? bookmark : b)));
    return bookmark;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { bookmarks, loading, error, refetch: fetch, add, update, remove };
}

export function useCollectionBookmarks(collectionIds: string[]) {
  const [data, setData] = useState<Record<string, api.Bookmark[]>>({});
  const [loading, setLoading] = useState(false);
  const fetchGenRef = useRef(0);

  const fetch = useCallback(async (force = false) => {
    if (collectionIds.length === 0) {
      setData({});
      setLoading(false);
      return;
    }

    await ensureDataCacheLoaded();

    const fromCache: Record<string, api.Bookmark[]> = {};
    const missing: string[] = [];
    for (const id of collectionIds) {
      const cached = getCachedBookmarks(id);
      if (cached && !force) {
        fromCache[id] = cached;
      } else {
        missing.push(id);
      }
    }

    if (Object.keys(fromCache).length > 0) {
      setData(() => {
        const next: Record<string, api.Bookmark[]> = {};
        for (const id of collectionIds) {
          next[id] = fromCache[id] ?? getCachedBookmarks(id) ?? [];
        }
        return next;
      });
    }

    const hasAnyCache = collectionIds.some((id) => !!getCachedBookmarks(id));
    if (!hasAnyCache) setLoading(true);

    const gen = ++fetchGenRef.current;
    try {
      const toFetch = force ? collectionIds : (missing.length > 0 ? missing : collectionIds);
      const results = await Promise.all(
        toFetch.map(async (id) => {
          const bookmarks = await api.getBookmarks(id);
          return [id, bookmarks] as const;
        }),
      );

      if (gen !== fetchGenRef.current) return;

      for (const [id, bookmarks] of results) {
        setCachedBookmarks(id, bookmarks);
      }

      setData(() => {
        const next: Record<string, api.Bookmark[]> = {};
        for (const id of collectionIds) {
          next[id] = getCachedBookmarks(id) || [];
        }
        return next;
      });
    } catch {
      // keep cached data on failure
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [collectionIds]);

  useEffect(() => { fetch(); }, [fetch]);

  const reorder = useCallback(async (collectionId: string, orderedBookmarks: api.Bookmark[]) => {
    const bookmarkIds = orderedBookmarks.map((b) => b.id);
    await api.reorderBookmarks(collectionId, bookmarkIds);
    setCachedBookmarks(collectionId, orderedBookmarks);
    setData((prev) => ({ ...prev, [collectionId]: orderedBookmarks }));
  }, []);

  const update = useCallback(async (id: string, updates: Parameters<typeof api.updateBookmark>[1]) => {
    const bookmark = await api.updateBookmark(id, updates);
    setData((prev) => {
      const next = { ...prev };
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].filter((b) => b.id !== id);
        setCachedBookmarks(colId, next[colId]);
      }
      const targetColId = bookmark.collectionId;
      if (!next[targetColId]) next[targetColId] = [];
      next[targetColId] = [...next[targetColId], bookmark].sort((a, b) => a.orderIndex - b.orderIndex);
      setCachedBookmarks(targetColId, next[targetColId]);
      return next;
    });
    return bookmark;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deleteBookmark(id);
    setData((prev) => {
      const next = { ...prev };
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].filter((b) => b.id !== id);
        setCachedBookmarks(colId, next[colId]);
      }
      return next;
    });
  }, []);

  const add = useCallback(async (params: Parameters<typeof api.createBookmark>[0]) => {
    const bookmark = await api.createBookmark(params);
    setData((prev) => {
      const list = [...(prev[params.collectionId] || []), bookmark];
      setCachedBookmarks(params.collectionId, list);
      return { ...prev, [params.collectionId]: list };
    });
    return bookmark;
  }, []);

  const refetch = useCallback(() => fetch(true), [fetch]);

  return { data, loading, refetch, reorder, update, remove, add };
}
