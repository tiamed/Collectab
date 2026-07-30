import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@/lib/api';

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

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSpaces(orgId);
      setSpaces(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, enabled]);

  useEffect(() => { fetch(); }, [fetch]);

  return { spaces, loading, error, refetch: fetch };
}

export function useCollections(spaceId: string | null, enabled = true) {
  const [collections, setCollections] = useState<api.Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled || !spaceId) { setCollections([]); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCollections(spaceId);
      setCollections(data);
    } catch (e: any) {
      setError(e.message);
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
  const prevIdsRef = useRef<string>('');

  const fetch = useCallback(async () => {
    const idsKey = collectionIds.join(',');
    if (idsKey === prevIdsRef.current && Object.keys(data).length > 0) return;
    prevIdsRef.current = idsKey;

    if (collectionIds.length === 0) { setData({}); return; }
    setLoading(true);
    try {
      const results = await Promise.all(
        collectionIds.map(async (id) => {
          const bookmarks = await api.getBookmarks(id);
          return [id, bookmarks] as const;
        }),
      );
      setData(Object.fromEntries(results));
    } catch {
      // individual failures are silently ignored
    } finally {
      setLoading(false);
    }
  }, [collectionIds]);

  useEffect(() => { fetch(); }, [fetch]);

  const reorder = useCallback(async (collectionId: string, orderedBookmarks: api.Bookmark[]) => {
    const bookmarkIds = orderedBookmarks.map((b) => b.id);
    await api.reorderBookmarks(collectionId, bookmarkIds);
    setData((prev) => ({ ...prev, [collectionId]: orderedBookmarks }));
  }, []);

  const update = useCallback(async (id: string, updates: Parameters<typeof api.updateBookmark>[1]) => {
    const bookmark = await api.updateBookmark(id, updates);
    setData((prev) => {
      const next = { ...prev };
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].filter((b) => b.id !== id);
      }
      const targetColId = bookmark.collectionId;
      if (!next[targetColId]) next[targetColId] = [];
      next[targetColId].push(bookmark);
      next[targetColId].sort((a, b) => a.orderIndex - b.orderIndex);
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
      }
      return next;
    });
  }, []);

  const add = useCallback(async (params: Parameters<typeof api.createBookmark>[0]) => {
    const bookmark = await api.createBookmark(params);
    setData((prev) => ({
      ...prev,
      [params.collectionId]: [...(prev[params.collectionId] || []), bookmark],
    }));
    return bookmark;
  }, []);

  return { data, loading, refetch: fetch, reorder, update, remove, add };
}
