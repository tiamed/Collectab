import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import BookmarkCard from './BookmarkCard';
import EditBookmarkModal from './EditBookmarkModal';
import AddBookmarkModal from './AddBookmarkModal';
import DraggableBookmarkList from './DraggableBookmarkList';
import type { Collection, Bookmark } from '@/lib/api';

interface ContentAreaProps {
  collections: Collection[];
  bookmarksByCollection: Record<string, Bookmark[]>;
  loading: boolean;
  onUpdateBookmark: (id: string, updates: Partial<Bookmark>) => Promise<Bookmark>;
  onDeleteBookmark: (id: string) => Promise<void>;
  onAddBookmark: (params: { collectionId: string; title: string; url: string; description?: string; favicon?: string; tags?: string[] }) => Promise<Bookmark>;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onCollectionReorder: (collectionId: string, orderedBookmarks: Bookmark[]) => void;
  onTransferBookmark: (bookmarkId: string, targetCollectionId: string, newIndex: number) => void;
  allCollapsed: boolean | null;
  onResetCollapsed: () => void;
}

export default function ContentArea({
  collections,
  bookmarksByCollection,
  loading,
  onUpdateBookmark,
  onDeleteBookmark,
  onAddBookmark,
  onRenameCollection,
  onDeleteCollection,
  onCollectionReorder,
  onTransferBookmark,
  allCollapsed,
  onResetCollapsed,
}: ContentAreaProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [addingToCollection, setAddingToCollection] = useState<string | null>(null);
  const [menuColId, setMenuColId] = useState<string | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName, setEditColName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (allCollapsed === null) return;
    const next: Record<string, boolean> = {};
    collections.forEach((c) => { next[c.id] = allCollapsed; });
    setCollapsed(next);
    onResetCollapsed();
  }, [allCollapsed, collections, onResetCollapsed]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuColId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (editingColId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingColId]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const commitRenameCol = () => {
    if (editingColId && editColName.trim()) {
      onRenameCollection(editingColId, editColName.trim());
    }
    setEditingColId(null);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeBookmark = useMemo(() => {
    if (!activeId) return null;
    for (const bks of Object.values(bookmarksByCollection)) {
      const found = bks.find((b) => b.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, bookmarksByCollection]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  const dropTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearOverlay = useCallback(() => {
    if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) { clearOverlay(); return; }

    const activeData = active.data.current as { type: string; collectionId: string } | null;
    const overData = over.data.current as { type: string; collectionId: string } | null;
    if (!activeData || !overData) { clearOverlay(); return; }

    if (activeData.type === 'bookmark' && overData.type === 'bookmark') {
      if (activeData.collectionId === overData.collectionId) {
        const colId = activeData.collectionId;
        const current = bookmarksByCollection[colId] || [];
        const oldIndex = current.findIndex((b) => b.id === active.id);
        const newIndex = current.findIndex((b) => b.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onCollectionReorder(colId, arrayMove(current, oldIndex, newIndex));
        }
        clearOverlay();
      } else {
        const targetItems = bookmarksByCollection[overData.collectionId] || [];
        const newIndex = targetItems.findIndex((b) => b.id === over.id);
        if (newIndex !== -1) {
          dropTimerRef.current = setTimeout(() => {
            onTransferBookmark(active.id as string, overData.collectionId, newIndex);
            setActiveId(null);
          }, 200);
        }
      }
    } else if (activeData.type === 'bookmark' && overData.type === 'collection') {
      const targetItems = bookmarksByCollection[overData.collectionId] || [];
      dropTimerRef.current = setTimeout(() => {
        onTransferBookmark(active.id as string, overData.collectionId, targetItems.length);
        setActiveId(null);
      }, 200);
    } else {
      clearOverlay();
    }
  }, [bookmarksByCollection, onCollectionReorder, onTransferBookmark, clearOverlay]);

  if (loading && collections.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-[var(--muted)]">Loading...</span>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-[var(--muted)]">No collections in this space</span>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
      {collections.map((collection) => {
        const bookmarks = bookmarksByCollection[collection.id] || [];
        const isCollapsed = collapsed[collection.id] ?? false;

        return (
          <section key={collection.id} className="group/section">
            <div className="relative flex items-center gap-2 mb-3">
              <button
                className="flex items-center gap-1.5"
                onClick={() => toggleCollapse(collection.id)}
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3.5 text-[var(--muted)]" strokeWidth={2} />
                ) : (
                  <ChevronDown className="size-3.5 text-[var(--muted)]" strokeWidth={2} />
                )}
              </button>

              {editingColId === collection.id ? (
                <input
                  ref={editInputRef}
                  className="rounded bg-[var(--background)] px-1.5 py-0.5 text-sm font-semibold text-[var(--foreground)] outline-none ring-1 ring-[var(--success)]"
                  value={editColName}
                  onChange={(e) => setEditColName(e.target.value)}
                  onBlur={commitRenameCol}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRenameCol();
                    if (e.key === 'Escape') setEditingColId(null);
                  }}
                />
              ) : (
                <h2 className="text-sm font-semibold text-[var(--foreground)]">{collection.name}</h2>
              )}

              <span className="text-[10px] text-[var(--muted)]">{bookmarks.length}</span>

              <button
                onClick={() => setAddingToCollection(collection.id)}
                className="flex size-5 items-center justify-center rounded text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface)] hover:text-[var(--foreground)] group-hover/section:opacity-100"
                title="Add bookmark"
              >
                <Plus className="size-3" strokeWidth={2} />
              </button>

              <button
                className="flex size-5 items-center justify-center rounded text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface)] hover:text-[var(--foreground)] group-hover/section:opacity-100"
                onClick={() => setMenuColId(menuColId === collection.id ? null : collection.id)}
              >
                <MoreHorizontal className="size-3.5" />
              </button>

              {menuColId === collection.id && (
                <div
                  ref={menuRef}
                  className="absolute left-20 top-6 z-50 min-w-[120px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl"
                >
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-[var(--foreground)] hover:bg-[var(--background)]"
                    onClick={() => {
                      setEditingColId(collection.id);
                      setEditColName(collection.name);
                      setMenuColId(null);
                    }}
                  >
                    <Pencil className="size-3" />
                    Rename
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-[var(--background)]"
                    onClick={() => {
                      setMenuColId(null);
                      onDeleteCollection(collection.id);
                    }}
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <DraggableBookmarkList
                collectionId={collection.id}
                bookmarks={bookmarks}
                onEdit={(b) => setEditingBookmark(b)}
                onDelete={(id) => onDeleteBookmark(id)}
                onAddClick={() => setAddingToCollection(collection.id)}
              />
            )}
          </section>
        );
      })}

      {editingBookmark && (
        <EditBookmarkModal
          bookmark={editingBookmark}
          collections={collections}
          onSave={async (updates) => {
            await onUpdateBookmark(editingBookmark.id, updates);
            setEditingBookmark(null);
          }}
          onClose={() => setEditingBookmark(null)}
        />
      )}

      {addingToCollection && (
        <AddBookmarkModal
          collectionId={addingToCollection}
          onSave={async (params) => {
            await onAddBookmark(params);
            setAddingToCollection(null);
          }}
          onClose={() => setAddingToCollection(null)}
        />
      )}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
        {activeBookmark ? (
          <div className="rotate-3 scale-105 opacity-90">
            <BookmarkCard bookmark={activeBookmark} onEdit={() => {}} onDelete={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  );
}
