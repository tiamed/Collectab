import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Bookmark } from '@/lib/api';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BookmarkCard({ bookmark, onEdit, onDelete }: BookmarkCardProps) {
  // Track which src failed so a new favicon URL after sync/edit retries <img>
  const [failedFavicon, setFailedFavicon] = useState<string | null>(null);
  const showFavicon = Boolean(bookmark.favicon) && failedFavicon !== bookmark.favicon;
  const domain = (() => {
    try { return new URL(bookmark.url).hostname.replace('www.', ''); }
    catch { return bookmark.url; }
  })();

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex w-[168px] flex-col gap-1.5 rounded-md bg-[var(--surface)] p-2.5 transition-colors hover:brightness-95 dark:hover:brightness-110"
    >
      {/* Action buttons */}
      <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="flex size-5 items-center justify-center rounded bg-[var(--background)]/80 text-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
        >
          <Pencil className="size-3" />
        </button>
        <button
          className="flex size-5 items-center justify-center rounded bg-[var(--background)]/80 text-[var(--muted)] hover:text-red-400"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        {showFavicon ? (
          <img
            src={bookmark.favicon!}
            alt=""
            className="size-4 shrink-0 rounded-sm"
            onError={() => setFailedFavicon(bookmark.favicon ?? null)}
          />
        ) : (
          <div className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-[var(--muted)]/20 text-[8px] font-bold text-[var(--muted)]">
            {bookmark.title[0]?.toUpperCase()}
          </div>
        )}
        <span className="truncate text-xs font-medium text-[var(--foreground)]">{bookmark.title}</span>
      </div>

      {/* Description */}
      {bookmark.description && (
        <p className="line-clamp-2 text-[10px] leading-[1.3] text-[var(--muted)]">
          {bookmark.description}
        </p>
      )}

      {/* Domain fallback if no description */}
      {!bookmark.description && (
        <p className="truncate text-[10px] text-[var(--muted)]">{domain}</p>
      )}
    </a>
  );
}
