import { useState, useEffect, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Folder } from 'lucide-react';
import type { Collection } from '@/lib/api';

interface SortCollectionsModalProps {
  collections: Collection[];
  loading?: boolean;
  onReorder: (orderedIds: string[]) => void;
  onClose: () => void;
}

function SortableRow({ collection }: { collection: Collection }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: collection.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform ? { x: 0, y: transform.y, scaleX: 1, scaleY: 1 } : null),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2"
    >
      <button
        type="button"
        className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-[var(--muted)] active:cursor-grabbing hover:text-[var(--foreground)]"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-3.5" strokeWidth={1.5} />
      </button>
      <Folder className="size-3.5 text-[var(--muted)]" strokeWidth={1.5} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--foreground)]">
        {collection.name}
      </span>
    </div>
  );
}

export default function SortCollectionsModal({
  collections,
  loading,
  onReorder,
  onClose,
}: SortCollectionsModalProps) {
  const [orderedIds, setOrderedIds] = useState(() => collections.map((c) => c.id));
  const dirtyRef = useRef(false);

  // Sync from parent after open-time refetch, but never clobber an in-progress local reorder.
  useEffect(() => {
    if (dirtyRef.current) return;
    setOrderedIds(collections.map((c) => c.id));
  }, [collections]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(orderedIds, oldIndex, newIndex);
    dirtyRef.current = true;
    setOrderedIds(reordered);
    onReorder(reordered);
  }

  const ordered = orderedIds
    .map((id) => collections.find((c) => c.id === id))
    .filter(Boolean) as Collection[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)]" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Sort collections</h3>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">Drag to reorder. Changes save immediately.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {loading && ordered.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Loading...</p>
          ) : ordered.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No collections</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {ordered.map((collection) => (
                    <SortableRow key={collection.id} collection={collection} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
