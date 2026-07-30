import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Toolbar from '@/components/Toolbar';
import ContentArea from '@/components/ContentArea';
import SettingsModal from '@/components/SettingsModal';
import AuthModal from '@/components/AuthModal';
import MembersModal from '@/components/MembersModal';
import PromptModal from '@/components/PromptModal';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteOrgModal from '@/components/DeleteOrgModal';
import { useOrganizations, useSpaces, useCollections, useCollectionBookmarks } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { loadApiBase, createCollection, createSpace, createOrganization, updateOrganization, deleteOrganization, updateSpace, deleteSpace, deleteAllSpaces, updateCollection, deleteCollection, updateBookmark } from '@/lib/api';
import type { Bookmark } from '@/lib/api';

const STORAGE_KEY_ORG = 'active_org_id';
const STORAGE_KEY_SPACE = 'active_space_id';
const STORAGE_KEY_PERSONAL_NAME = 'personal_org_name';

export default function App() {
  const [ready, setReady] = useState(false);
  const [activeOrgId, setActiveOrgIdRaw] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceIdRaw] = useState<string | null>(null);

  const setActiveOrgId = (id: string | null) => {
    setActiveOrgIdRaw(id);
    if (id) chrome.storage.local.set({ [STORAGE_KEY_ORG]: id });
    else chrome.storage.local.remove(STORAGE_KEY_ORG);
  };

  const setActiveSpaceId = (id: string | null) => {
    setActiveSpaceIdRaw(id);
    if (id) chrome.storage.local.set({ [STORAGE_KEY_SPACE]: id });
    else chrome.storage.local.remove(STORAGE_KEY_SPACE);
  };
  const [personalName, setPersonalNameRaw] = useState('Personal');

  const setPersonalName = (name: string) => {
    setPersonalNameRaw(name);
    chrome.storage.local.set({ [STORAGE_KEY_PERSONAL_NAME]: name });
  };

  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allCollapsed, setAllCollapsed] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  // Prompt modal state
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<{ title: string; label?: string; placeholder?: string; defaultValue?: string }>({ title: '' });
  const promptResolveRef = useRef<((value: string | null) => void) | null>(null);

  const openPrompt = useCallback((config: typeof promptConfig): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptConfig(config);
      promptResolveRef.current = resolve;
      setPromptOpen(true);
    });
  }, []);

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; confirmLabel?: string }>({ title: '', message: '' });
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const openConfirm = useCallback((config: typeof confirmConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmConfig(config);
      confirmResolveRef.current = resolve;
      setConfirmOpen(true);
    });
  }, []);

  useEffect(() => {
    Promise.all([
      loadApiBase(),
      chrome.storage.local.get([STORAGE_KEY_ORG, STORAGE_KEY_SPACE, STORAGE_KEY_PERSONAL_NAME]),
    ]).then(([, stored]) => {
      if (stored[STORAGE_KEY_ORG]) setActiveOrgIdRaw(stored[STORAGE_KEY_ORG]);
      if (stored[STORAGE_KEY_SPACE]) setActiveSpaceIdRaw(stored[STORAGE_KEY_SPACE]);
      if (stored[STORAGE_KEY_PERSONAL_NAME]) setPersonalNameRaw(stored[STORAGE_KEY_PERSONAL_NAME]);
      setReady(true);
    });
  }, []);

  const { user, loading: authLoading, login, register, logout } = useAuth(ready);
  const { theme, toggle: toggleTheme } = useTheme();

  const loggedIn = !!user;
  const { orgs, loading: orgsLoading, refetch: refetchOrgs } = useOrganizations(loggedIn);
  const { spaces, loading: spacesLoading, refetch: refetchSpaces } = useSpaces(activeOrgId, loggedIn);
  const { collections, loading: colsLoading, refetch: refetchCollections } = useCollections(activeSpaceId, loggedIn);

  // Don't auto-select org; start with "Personal" (null) by default

  useEffect(() => {
    if (spaces.length > 0 && (!activeSpaceId || !spaces.find((s) => s.id === activeSpaceId))) {
      setActiveSpaceId(spaces[0].id);
    } else if (spaces.length === 0) {
      setActiveSpaceId(null);
    }
  }, [spaces, activeSpaceId]);

  const collectionIds = useMemo(() => collections.map((c) => c.id), [collections]);
  const {
    data: bookmarksByCollection,
    loading: bksLoading,
    update,
    remove,
    add,
    reorder,
    refetch: refetchBookmarks,
  } = useCollectionBookmarks(collectionIds);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const bks of Object.values(bookmarksByCollection)) {
      for (const b of bks) {
        b.tags?.forEach((t) => tags.add(t));
      }
    }
    return Array.from(tags).sort();
  }, [bookmarksByCollection]);

  const filteredBookmarks = useMemo(() => {
    const result: Record<string, Bookmark[]> = {};
    for (const [colId, bks] of Object.entries(bookmarksByCollection)) {
      let filtered = bks;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.url.toLowerCase().includes(q) ||
            (b.description?.toLowerCase().includes(q)),
        );
      }
      if (tagFilter) {
        filtered = filtered.filter((b) => b.tags?.includes(tagFilter));
      }
      result[colId] = filtered;
    }
    return result;
  }, [bookmarksByCollection, searchQuery, tagFilter]);

  const handleAddCollection = useCallback(async () => {
    if (!activeSpaceId) return;
    const name = await openPrompt({ title: 'New Collection', label: 'Name', placeholder: 'Collection name' });
    if (!name) return;
    await createCollection(activeSpaceId, name);
    refetchCollections();
  }, [activeSpaceId, refetchCollections, openPrompt]);

  const handleAddSpace = useCallback(async () => {
    const name = await openPrompt({ title: 'New Space', label: 'Name', placeholder: 'Space name' });
    if (!name) return;
    await createSpace(name, undefined, activeOrgId);
    refetchSpaces();
  }, [activeOrgId, refetchSpaces, openPrompt]);

  const handleAddOrg = useCallback(async () => {
    const name = await openPrompt({ title: 'New Organization', label: 'Name', placeholder: 'Organization name' });
    if (!name) return;
    const org = await createOrganization(name);
    refetchOrgs();
    setActiveOrgId(org.id);
    setActiveSpaceId(null);
  }, [refetchOrgs, openPrompt]);

  const handleRenameOrg = useCallback(async (id: string, currentName: string) => {
    const name = await openPrompt({ title: 'Rename Organization', label: 'Name', placeholder: 'Organization name', defaultValue: currentName });
    if (!name || name === currentName) return;
    await updateOrganization(id, { name });
    refetchOrgs();
  }, [refetchOrgs, openPrompt]);

  const handleRenamePersonal = useCallback(async () => {
    const name = await openPrompt({ title: 'Rename Personal Space', label: 'Name', placeholder: 'Personal', defaultValue: personalName });
    if (!name || name === personalName) return;
    setPersonalName(name);
  }, [personalName, openPrompt]);

  const [deleteOrgTarget, setDeleteOrgTarget] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteOrg = useCallback(async () => {
    if (!deleteOrgTarget) return;
    await deleteOrganization(deleteOrgTarget.id);
    if (activeOrgId === deleteOrgTarget.id) {
      setActiveOrgId(null);
      setActiveSpaceId(null);
    }
    setDeleteOrgTarget(null);
    refetchOrgs();
  }, [deleteOrgTarget, activeOrgId, refetchOrgs]);

  const handleReorderSpaces = useCallback(async (orderedIds: string[]) => {
    await Promise.all(orderedIds.map((id, i) => updateSpace(id, { orderIndex: i })));
    refetchSpaces();
  }, [refetchSpaces]);

  const handleRenameSpace = useCallback(async (id: string, name: string) => {
    await updateSpace(id, { name });
    refetchSpaces();
  }, [refetchSpaces]);

  const handleDeleteSpace = useCallback(async (id: string) => {
    const confirmed = await openConfirm({ title: 'Delete Space', message: 'Delete this space and all its collections? This cannot be undone.', confirmLabel: 'Delete' });
    if (!confirmed) return;
    await deleteSpace(id);
    if (activeSpaceId === id) {
      setActiveSpaceId(null);
    }
    refetchSpaces();
  }, [activeSpaceId, refetchSpaces, openConfirm]);

  const handleRenameCollection = useCallback(async (id: string, name: string) => {
    await updateCollection(id, { name });
    refetchCollections();
  }, [refetchCollections]);

  const handleDeleteCollection = useCallback(async (id: string) => {
    const confirmed = await openConfirm({ title: 'Delete Collection', message: 'Delete this collection and all its bookmarks? This cannot be undone.', confirmLabel: 'Delete' });
    if (!confirmed) return;
    await deleteCollection(id);
    refetchCollections();
  }, [refetchCollections, openConfirm]);

  const handleCollectionReorder = useCallback(async (collectionId: string, orderedBookmarks: Bookmark[]) => {
    try {
      await reorder(collectionId, orderedBookmarks);
    } catch {
      // noop - DnD state already reflects the change
    }
  }, [reorder]);

  const handleTransferBookmark = useCallback(async (bookmarkId: string, targetCollectionId: string, newIndex: number) => {
    try {
      await update(bookmarkId, { collectionId: targetCollectionId, orderIndex: newIndex });
    } catch {
      // noop - DnD state already reflects the change
    }
  }, [update]);

  const handleDeleteAllSpaces = useCallback(async () => {
    await deleteAllSpaces(activeOrgId);
    setActiveSpaceId(null);
    refetchSpaces();
  }, [activeOrgId, refetchSpaces]);

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.reload();
  }, [logout]);

  const handleImportDone = useCallback(() => {
    refetchOrgs();
    refetchSpaces();
    setActiveSpaceId(null);
  }, [refetchOrgs, refetchSpaces]);

  if (!ready || authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--background)]">
        <span className="text-sm text-[var(--muted)]">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[var(--background)]">
        <div className="text-center">
          <h1 className="mb-2 text-lg font-semibold text-[var(--foreground)]">Collectab</h1>
          <p className="mb-4 text-xs text-[var(--muted)]">Sign in to access your bookmarks</p>
        </div>
        <button
          onClick={() => setShowAuth(true)}
          className="rounded bg-[var(--success)] px-6 py-2 text-sm font-medium text-[#12121a]"
        >
          Sign In / Register
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Configure server URL
        </button>

        {showAuth && (
          <AuthModal onClose={() => setShowAuth(false)} onLogin={login} onRegister={register} />
        )}
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} onImportDone={handleImportDone} activeOrgId={activeOrgId} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[var(--background)]">
      <Sidebar
        orgs={orgs}
        activeOrgId={activeOrgId}
        personalName={personalName}
        onOrgSelect={(id) => { setActiveOrgId(id || null); setActiveSpaceId(null); }}
        onAddOrg={handleAddOrg}
        onRenameOrg={handleRenameOrg}
        onRenamePersonal={handleRenamePersonal}
        onDeleteOrg={(id, name) => setDeleteOrgTarget({ id, name })}
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSpaceSelect={setActiveSpaceId}
        onAddSpace={handleAddSpace}
        onRenameSpace={handleRenameSpace}
        onDeleteSpace={handleDeleteSpace}
        onReorderSpaces={handleReorderSpaces}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setShowSettings(true)}
        user={user}
        onAccountClick={() => setShowAuth(true)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          spaceName={activeSpace?.name ?? ''}
          collectionCount={collections.length}
          onAddCollection={handleAddCollection}
          onOpenSettings={() => setShowSettings(true)}
          onManageMembers={() => setShowMembers(true)}
        />
        <Toolbar
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          allTags={allTags}
          onExpandAll={() => setAllCollapsed(false)}
          onCollapseAll={() => setAllCollapsed(true)}
        />
        <ContentArea
          collections={collections}
          bookmarksByCollection={filteredBookmarks}
          loading={colsLoading || bksLoading}
          onUpdateBookmark={update}
          onDeleteBookmark={remove}
          onAddBookmark={add}
          onRenameCollection={handleRenameCollection}
          onDeleteCollection={handleDeleteCollection}
          onCollectionReorder={handleCollectionReorder}
          onTransferBookmark={handleTransferBookmark}
          allCollapsed={allCollapsed}
          onResetCollapsed={() => setAllCollapsed(null)}
        />
      </main>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onImportDone={handleImportDone} activeOrgId={activeOrgId} activeOrgName={orgs.find((o) => o.id === activeOrgId)?.name ?? personalName} onDeleteAllSpaces={handleDeleteAllSpaces} />
      )}
      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onLogin={login} onRegister={register} />
      )}
      {showMembers && (
        <MembersModal
          orgId={activeOrgId}
          orgName={orgs.find((o) => o.id === activeOrgId)?.name}
          spaceId={activeSpaceId}
          spaceName={activeSpace?.name ?? ''}
          onClose={() => setShowMembers(false)}
        />
      )}

      <PromptModal
        isOpen={promptOpen}
        title={promptConfig.title}
        label={promptConfig.label}
        placeholder={promptConfig.placeholder}
        defaultValue={promptConfig.defaultValue}
        onSubmit={(value) => {
          promptResolveRef.current?.(value);
          promptResolveRef.current = null;
          setPromptOpen(false);
        }}
        onClose={() => {
          promptResolveRef.current?.(null);
          promptResolveRef.current = null;
          setPromptOpen(false);
        }}
      />

      <ConfirmModal
        isOpen={confirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        onConfirm={() => {
          confirmResolveRef.current?.(true);
          confirmResolveRef.current = null;
          setConfirmOpen(false);
        }}
        onClose={() => {
          confirmResolveRef.current?.(false);
          confirmResolveRef.current = null;
          setConfirmOpen(false);
        }}
      />

      <DeleteOrgModal
        isOpen={!!deleteOrgTarget}
        orgName={deleteOrgTarget?.name ?? ''}
        onConfirm={handleDeleteOrg}
        onClose={() => setDeleteOrgTarget(null)}
      />
    </div>
  );
}
