import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@/lib/api';
import {
  ensureDataCacheLoaded,
  getCachedOrganizations,
  setCachedOrganizations,
  getCachedSpaces,
  setCachedSpaces,
  getCachedCollections,
  setCachedCollections,
  getCachedBookmarksBySpace,
  setCachedBookmarksBySpace,
  setCachedBookmarksForCollection,
} from '@/lib/dataCache';
import { subscribeBookmarksChanged } from '@/lib/bookmarksSync';

export function useOrganizations(enabled = true) {
  const [orgs, setOrgs] = useState<api.Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!enabled) return;

    await ensureDataCacheLoaded();
    const cached = getCachedOrganizations();
    if (cached) {
      setOrgs(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await api.getOrganizations();
      setCachedOrganizations(data);
      setOrgs(data);
    } catch {
      // keep cache
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { void fetch(); }, [fetch]);

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

export function useCollectionBookmarks(spaceId: string | null) {
  const [data, setData] = useState<Record<string, api.Bookmark[]>>({});
  const [loading, setLoading] = useState(false);
  const fetchGenRef = useRef(0);

  /** Drop in-flight GET results so they cannot overwrite local mutations. */
  const bumpFetchGen = useCallback(() => {
    fetchGenRef.current += 1;
  }, []);

  const fetch = useCallback(async (_force = false) => {
    if (!spaceId) {
      setData({});
      setLoading(false);
      return;
    }

    await ensureDataCacheLoaded();
    const cached = getCachedBookmarksBySpace(spaceId);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const gen = ++fetchGenRef.current;
    try {
      const byCollection = await api.getBookmarksBySpace(spaceId);
      if (gen !== fetchGenRef.current) return;

      setCachedBookmarksBySpace(spaceId, byCollection);
      setData(byCollection);
    } catch {
      // keep previous / cached data on failure
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  // Popup (and other pages) signal via chrome.storage — refetch when relevant.
  // Hidden newtabs defer the fetch until they become visible again.
  useEffect(() => {
    let pending = false;

    const refreshIfNeeded = () => {
      if (!spaceId) return;
      pending = false;
      void fetch(true);
    };

    const unsub = subscribeBookmarksChanged((event) => {
      if (!spaceId) return;
      if (event.spaceId && event.spaceId !== spaceId) return;
      if (typeof document !== 'undefined' && document.hidden) {
        pending = true;
        return;
      }
      refreshIfNeeded();
    });

    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden && pending) {
        refreshIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [spaceId, fetch]);

  const reorder = useCallback(async (collectionId: string, orderedBookmarks: api.Bookmark[]) => {
    if (!spaceId) return;
    bumpFetchGen();
    const bookmarkIds = orderedBookmarks.map((b) => b.id);
    await api.reorderBookmarks(collectionId, bookmarkIds);
    setData((prev) => ({ ...prev, [collectionId]: orderedBookmarks }));
    await setCachedBookmarksForCollection(spaceId, collectionId, orderedBookmarks, { flush: true });
  }, [spaceId, bumpFetchGen]);

  /** Optimistic local reorder without REST (CRDT path). */
  const reorderLocal = useCallback((collectionId: string, orderedBookmarks: api.Bookmark[]) => {
    if (!spaceId) return;
    bumpFetchGen();
    setData((prev) => ({ ...prev, [collectionId]: orderedBookmarks }));
    void setCachedBookmarksForCollection(spaceId, collectionId, orderedBookmarks, { flush: true });
  }, [spaceId, bumpFetchGen]);

  const update = useCallback(async (id: string, updates: Parameters<typeof api.updateBookmark>[1]) => {
    const bookmark = await api.updateBookmark(id, updates);
    if (!spaceId) return bookmark;
    bumpFetchGen();
    let next: Record<string, api.Bookmark[]> = {};
    setData((prev) => {
      next = { ...prev };
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].filter((b) => b.id !== id);
      }
      const targetColId = bookmark.collectionId;
      if (!next[targetColId]) next[targetColId] = [];
      next[targetColId] = [...next[targetColId], bookmark].sort((a, b) => a.orderIndex - b.orderIndex);
      return next;
    });
    await setCachedBookmarksBySpace(spaceId, next, { flush: true });
    return bookmark;
  }, [spaceId, bumpFetchGen]);

  const remove = useCallback(async (id: string) => {
    await api.deleteBookmark(id);
    if (!spaceId) return;
    bumpFetchGen();
    let next: Record<string, api.Bookmark[]> = {};
    setData((prev) => {
      next = { ...prev };
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].filter((b) => b.id !== id);
      }
      return next;
    });
    await setCachedBookmarksBySpace(spaceId, next, { flush: true });
  }, [spaceId, bumpFetchGen]);

  const add = useCallback(async (params: Parameters<typeof api.createBookmark>[0]) => {
    const bookmark = await api.createBookmark(params);
    if (!spaceId) return bookmark;
    bumpFetchGen();
    let next: Record<string, api.Bookmark[]> = {};
    setData((prev) => {
      const list = [...(prev[params.collectionId] || []), bookmark];
      next = { ...prev, [params.collectionId]: list };
      return next;
    });
    await setCachedBookmarksBySpace(spaceId, next, { flush: true });
    return bookmark;
  }, [spaceId, bumpFetchGen]);

  const refetch = useCallback(() => fetch(true), [fetch]);

  return { data, loading, refetch, reorder, reorderLocal, update, remove, add };
}
