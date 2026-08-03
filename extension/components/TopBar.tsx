import { UserPlus, Settings, Plus, ArrowDownZA } from 'lucide-react';

interface TopBarProps {
  spaceName: string;
  collectionCount: number;
  onAddCollection: () => void;
  onSortCollections: () => void;
  onOpenSettings: () => void;
  onManageMembers: () => void;
  canEditContent?: boolean;
  canManageMembers?: boolean;
  canManageSpace?: boolean;
}

export default function TopBar({
  spaceName,
  collectionCount,
  onAddCollection,
  onSortCollections,
  onOpenSettings,
  onManageMembers,
  canEditContent = true,
  canManageMembers = true,
  canManageSpace = true,
}: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
      <div className="flex items-center gap-2.5">
        <h1 className="text-[15px] font-semibold text-[var(--foreground)]">{spaceName}</h1>
        <span className="text-xs text-[var(--muted)]">{collectionCount} collections</span>
      </div>

      <div className="flex items-center gap-1.5">
        {canEditContent && (
          <button
            onClick={onSortCollections}
            disabled={collectionCount === 0}
            className="flex size-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:hover:bg-transparent"
            title="Sort collections"
          >
            <ArrowDownZA className="size-4" strokeWidth={1.5} />
          </button>
        )}
        {canManageMembers && (
          <button
            onClick={onManageMembers}
            className="flex size-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface)]"
            title="Manage members"
          >
            <UserPlus className="size-4" strokeWidth={1.5} />
          </button>
        )}
        {canManageSpace && (
          <button
            onClick={onOpenSettings}
            className="flex size-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface)]"
            title="Space settings"
          >
            <Settings className="size-4" strokeWidth={1.5} />
          </button>
        )}
        {canEditContent && (
          <button
            onClick={onAddCollection}
            className="flex h-7 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5"
            title="Add collection"
          >
            <Plus className="size-[14px] text-white" strokeWidth={2} />
          </button>
        )}
      </div>
    </header>
  );
}
