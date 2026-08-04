import { clearDataCache, hasCachedData } from './dataCache';

const STORAGE_KEY_BASE_URL = 'api_base_url';
const STORAGE_KEY_ACCESS_TOKEN = 'access_token';
const STORAGE_KEY_REFRESH_TOKEN = 'refresh_token';
const SESSION_UI_KEYS = [
  'active_org_id',
  'active_space_id',
  'popup_last_space',
  'popup_last_collection',
  'personal_org_name',
] as const;
const DEFAULT_API_BASE = 'http://localhost:3001/api';

let apiBase: string = DEFAULT_API_BASE;
let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function loadApiBase() {
  const stored = await chrome.storage.local.get([STORAGE_KEY_BASE_URL, STORAGE_KEY_ACCESS_TOKEN, STORAGE_KEY_REFRESH_TOKEN]);
  if (stored[STORAGE_KEY_BASE_URL]) {
    apiBase = stored[STORAGE_KEY_BASE_URL];
  }
  if (stored[STORAGE_KEY_ACCESS_TOKEN]) {
    accessToken = stored[STORAGE_KEY_ACCESS_TOKEN];
  }
  if (stored[STORAGE_KEY_REFRESH_TOKEN]) {
    refreshToken = stored[STORAGE_KEY_REFRESH_TOKEN];
  }
}

/**
 * Update API base URL. When the URL changes, clear auth tokens, data cache,
 * and UI selection so the previous server's orgs/spaces cannot linger.
 */
export async function setApiBase(url: string): Promise<{ changed: boolean; hadSession: boolean }> {
  const next = url.replace(/\/+$/, '');
  const changed = next !== apiBase;
  apiBase = next;
  await chrome.storage.local.set({ [STORAGE_KEY_BASE_URL]: apiBase });

  let hadSession = false;
  if (changed) {
    const before = await chrome.storage.local.get([
      STORAGE_KEY_ACCESS_TOKEN,
      STORAGE_KEY_REFRESH_TOKEN,
      ...SESSION_UI_KEYS,
    ]);
    hadSession =
      !!before[STORAGE_KEY_ACCESS_TOKEN] ||
      !!before[STORAGE_KEY_REFRESH_TOKEN] ||
      SESSION_UI_KEYS.some((k) => before[k]) ||
      hasCachedData();
    await clearTokens();
    await clearDataCache();
    await chrome.storage.local.remove([...SESSION_UI_KEYS]);
  }

  return { changed, hadSession };
}

export function getApiBase() {
  return apiBase;
}

export function getToken() {
  return accessToken;
}

export function isLoggedIn() {
  return !!accessToken;
}

async function persistTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  await chrome.storage.local.set({
    [STORAGE_KEY_ACCESS_TOKEN]: access,
    [STORAGE_KEY_REFRESH_TOKEN]: refresh,
  });
}

async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await chrome.storage.local.remove([STORAGE_KEY_ACCESS_TOKEN, STORAGE_KEY_REFRESH_TOKEN]);
}

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return false;
    }
    const data = await res.json();
    await persistTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${apiBase}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  if (res.status === 401 && retry && refreshToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// Auth
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export async function login(email: string, password: string): Promise<{ user: User }> {
  const data = await request<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await persistTokens(data.accessToken, data.refreshToken);
  return { user: data.user };
}

export async function register(email: string, password: string, name: string): Promise<{ user: User }> {
  const data = await request<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  await persistTokens(data.accessToken, data.refreshToken);
  return { user: data.user };
}

export async function getMe(): Promise<User | null> {
  if (!accessToken) return null;
  try {
    const data = await request<{ user: User }>('/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

export async function logout() {
  await clearTokens();
}

// Organizations
export interface Organization {
  id: string;
  name: string;
  icon: string;
  ownerId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export async function getOrganizations(): Promise<Organization[]> {
  const data = await request<{ organizations: Organization[] }>('/orgs');
  return data.organizations;
}

export async function createOrganization(name: string, icon?: string): Promise<Organization> {
  const data = await request<{ organization: Organization }>('/orgs', {
    method: 'POST',
    body: JSON.stringify({ name, icon }),
  });
  return { ...data.organization, role: 'owner' };
}

export async function updateOrganization(id: string, updates: { name?: string; icon?: string }): Promise<Organization> {
  const data = await request<{ organization: Organization }>(`/orgs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.organization;
}

export async function deleteOrganization(id: string): Promise<void> {
  await request(`/orgs/${id}`, { method: 'DELETE' });
}

export interface OrgMember {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function getOrgMembers(orgId: string): Promise<{ owner: { id: string; email: string; name: string }; members: OrgMember[] }> {
  return request(`/orgs/${orgId}/members`);
}

export async function addOrgMember(orgId: string, email: string, role: 'admin' | 'member' = 'member'): Promise<OrgMember> {
  const data = await request<{ member: OrgMember }>(`/orgs/${orgId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  return data.member;
}

export async function removeOrgMember(orgId: string, memberId: string): Promise<void> {
  await request(`/orgs/${orgId}/members/${memberId}`, { method: 'DELETE' });
}

// Spaces
export interface Space {
  id: string;
  name: string;
  icon: string;
  orderIndex: number;
  ownerId: string;
  orgId?: string | null;
  createdAt: string;
}

export async function getSpaces(orgId?: string | null): Promise<Space[]> {
  const query = orgId ? `?orgId=${orgId}` : '';
  const data = await request<{ spaces: Space[] }>(`/spaces${query}`);
  return data.spaces;
}

export async function createSpace(name: string, icon?: string, orgId?: string | null): Promise<Space> {
  const data = await request<{ space: Space }>('/spaces', {
    method: 'POST',
    body: JSON.stringify({ name, icon, orgId: orgId || undefined }),
  });
  return data.space;
}

export async function updateSpace(id: string, updates: { name?: string; icon?: string; orderIndex?: number }): Promise<Space> {
  const data = await request<{ space: Space }>(`/spaces/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.space;
}

export async function deleteSpace(id: string): Promise<void> {
  await request(`/spaces/${id}`, { method: 'DELETE' });
}

export async function deleteAllSpaces(orgId?: string | null): Promise<void> {
  const query = orgId ? `?orgId=${orgId}` : '';
  await request(`/spaces${query}`, { method: 'DELETE' });
}

// Collections
export interface Collection {
  id: string;
  spaceId: string;
  name: string;
  icon: string;
  color: string;
  orderIndex: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export async function getCollections(spaceId?: string): Promise<Collection[]> {
  const query = spaceId ? `?spaceId=${spaceId}` : '';
  const data = await request<{ collections: Collection[] }>(`/collections${query}`);
  return data.collections;
}

export async function createCollection(spaceId: string, name: string, icon?: string, color?: string): Promise<Collection> {
  const data = await request<{ collection: Collection }>('/collections', {
    method: 'POST',
    body: JSON.stringify({ spaceId, name, icon, color }),
  });
  return data.collection;
}

export async function updateCollection(id: string, updates: { name?: string; icon?: string; color?: string; orderIndex?: number; spaceId?: string }): Promise<Collection> {
  const data = await request<{ collection: Collection }>(`/collections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.collection;
}

export async function deleteCollection(id: string): Promise<void> {
  await request(`/collections/${id}`, { method: 'DELETE' });
}

// Bookmarks
export interface Bookmark {
  id: string;
  collectionId: string;
  title: string;
  url: string;
  description: string | null;
  favicon: string | null;
  tags: string[];
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export async function reorderBookmarks(collectionId: string, bookmarkIds: string[]): Promise<void> {
  await request(`/bookmarks/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ collectionId, bookmarkIds }),
  });
}

export async function getBookmarks(collectionId: string): Promise<Bookmark[]> {
  const data = await request<{ bookmarks: Bookmark[] }>(`/bookmarks?collectionId=${collectionId}`);
  return data.bookmarks;
}

export async function getBookmarksBySpace(spaceId: string): Promise<Record<string, Bookmark[]>> {
  const data = await request<{ bookmarksByCollection: Record<string, Bookmark[]> }>(
    `/bookmarks?spaceId=${encodeURIComponent(spaceId)}`,
  );
  return data.bookmarksByCollection;
}

export async function createBookmark(params: {
  collectionId: string;
  title: string;
  url: string;
  description?: string;
  favicon?: string;
  tags?: string[];
}): Promise<Bookmark> {
  const data = await request<{ bookmark: Bookmark }>('/bookmarks', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data.bookmark;
}

export async function updateBookmark(id: string, updates: {
  title?: string;
  url?: string;
  description?: string;
  favicon?: string;
  tags?: string[];
  orderIndex?: number;
  collectionId?: string;
}): Promise<Bookmark> {
  const data = await request<{ bookmark: Bookmark }>(`/bookmarks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.bookmark;
}

export async function deleteBookmark(id: string): Promise<void> {
  await request(`/bookmarks/${id}`, { method: 'DELETE' });
}

export async function batchCreateBookmarks(collectionId: string, bookmarks: { title: string; url: string; description?: string; favicon?: string; tags?: string[] }[]): Promise<Bookmark[]> {
  const data = await request<{ bookmarks: Bookmark[] }>('/bookmarks/batch', {
    method: 'POST',
    body: JSON.stringify({ collectionId, bookmarks }),
  });
  return data.bookmarks;
}

// Import
export interface ImportResult {
  message: string;
  stats: { spacesCreated: number; collectionsCreated: number; bookmarksCreated: number };
}

export async function importFromNiceTab(data: unknown, orgId?: string | null): Promise<ImportResult> {
  return request<ImportResult>('/import', {
    method: 'POST',
    body: JSON.stringify({ format: 'nicetab', data, orgId: orgId || undefined }),
  });
}

export async function importFromToby(data: unknown, orgId?: string | null): Promise<ImportResult> {
  return request<ImportResult>('/import', {
    method: 'POST',
    body: JSON.stringify({ format: 'toby', data, orgId: orgId || undefined }),
  });
}

// Export
export interface ExportData {
  version: 1;
  exportedAt: string;
  spaces: Array<{
    name: string;
    icon: string;
    orderIndex: number;
    collections: Array<{
      name: string;
      icon: string;
      color: string;
      orderIndex: number;
      bookmarks: Array<{
        title: string;
        url: string;
        description: string | null;
        favicon: string | null;
        tags: string[];
        orderIndex: number;
      }>;
    }>;
  }>;
}

export async function exportData(orgId?: string | null): Promise<ExportData> {
  const allSpaces = await getSpaces(orgId);
  const exportSpaces: ExportData['spaces'] = [];

  for (const space of allSpaces) {
    const cols = await getCollections(space.id);
    const byCollection = await getBookmarksBySpace(space.id);
    const exportCols: ExportData['spaces'][0]['collections'] = [];

    for (const col of cols) {
      const bks = byCollection[col.id] || [];
      exportCols.push({
        name: col.name,
        icon: col.icon,
        color: col.color,
        orderIndex: col.orderIndex,
        bookmarks: bks.map((b) => ({
          title: b.title,
          url: b.url,
          description: b.description,
          favicon: b.favicon,
          tags: b.tags,
          orderIndex: b.orderIndex,
        })),
      });
    }

    exportSpaces.push({
      name: space.name,
      icon: space.icon,
      orderIndex: space.orderIndex,
      collections: exportCols,
    });
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    spaces: exportSpaces,
  };
}

export async function importNative(data: ExportData, orgId?: string | null): Promise<ImportResult> {
  return request<ImportResult>('/import', {
    method: 'POST',
    body: JSON.stringify({ format: 'native', data, orgId: orgId || undefined }),
  });
}

// Members
export interface SpaceMember {
  userId: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

export async function getSpaceMembers(spaceId: string): Promise<{ owner: { id: string; email: string; name: string }; members: SpaceMember[] }> {
  return request(`/members/${spaceId}`);
}

export async function addSpaceMember(spaceId: string, email: string, role: 'editor' | 'viewer' = 'viewer'): Promise<SpaceMember> {
  const data = await request<{ member: SpaceMember }>(`/members/${spaceId}`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  return data.member;
}

export async function updateMemberRole(spaceId: string, memberId: string, role: 'editor' | 'viewer'): Promise<void> {
  await request(`/members/${spaceId}/${memberId}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export async function removeSpaceMember(spaceId: string, memberId: string): Promise<void> {
  await request(`/members/${spaceId}/${memberId}`, { method: 'DELETE' });
}
