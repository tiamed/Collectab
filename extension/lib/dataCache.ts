import type { Space, Collection, Bookmark } from './api';

const CACHE_KEY = 'data_cache_v1';
const MAX_SPACES = 12;
const MAX_COLLECTION_SETS = 12;
const MAX_BOOKMARK_SETS = 40;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — long enough for idle sessions (e.g. watching a video)

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

interface DataCache {
  spaces: Record<string, CacheEntry<Space[]>>;
  collections: Record<string, CacheEntry<Collection[]>>;
  bookmarks: Record<string, CacheEntry<Bookmark[]>>;
}

const emptyCache = (): DataCache => ({
  spaces: {},
  collections: {},
  bookmarks: {},
});

let memory: DataCache = emptyCache();
let loaded = false;
let loadPromise: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function getEntry<T>(record: Record<string, CacheEntry<T>>, key: string): T | null {
  const entry = record[key];
  if (!entry) return null;
  // Still usable for instant display even if past TTL; hooks always refresh in background
  return entry.data;
}

function pruneRecord<T>(record: Record<string, CacheEntry<T>>, max: number) {
  const now = Date.now();
  for (const [key, entry] of Object.entries(record)) {
    if (now - entry.updatedAt > TTL_MS) delete record[key];
  }
  const entries = Object.entries(record).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  if (entries.length <= max) return;
  for (const [key] of entries.slice(max)) {
    delete record[key];
  }
}

function scheduleSave() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    pruneRecord(memory.spaces, MAX_SPACES);
    pruneRecord(memory.collections, MAX_COLLECTION_SETS);
    pruneRecord(memory.bookmarks, MAX_BOOKMARK_SETS);
    chrome.storage.local.set({ [CACHE_KEY]: memory }).catch(() => {});
  }, 200);
}

export async function ensureDataCacheLoaded() {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(CACHE_KEY);
        if (stored[CACHE_KEY]) {
          memory = { ...emptyCache(), ...stored[CACHE_KEY] };
        }
      }
    } catch {
      // ignore
    } finally {
      loaded = true;
    }
  })();
  return loadPromise;
}

export function getCachedSpaces(orgKey: string): Space[] | null {
  return getEntry(memory.spaces, orgKey);
}

export function setCachedSpaces(orgKey: string, data: Space[]) {
  memory.spaces[orgKey] = { data, updatedAt: Date.now() };
  scheduleSave();
}

export function getCachedCollections(spaceId: string): Collection[] | null {
  return getEntry(memory.collections, spaceId);
}

export function setCachedCollections(spaceId: string, data: Collection[]) {
  memory.collections[spaceId] = { data, updatedAt: Date.now() };
  scheduleSave();
}

export function getCachedBookmarks(collectionId: string): Bookmark[] | null {
  return getEntry(memory.bookmarks, collectionId);
}

export function setCachedBookmarks(collectionId: string, data: Bookmark[]) {
  memory.bookmarks[collectionId] = { data, updatedAt: Date.now() };
  scheduleSave();
}
