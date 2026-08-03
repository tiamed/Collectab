import { useState, useRef, useEffect } from 'react';
import { Tag } from 'lucide-react';

interface ToolbarProps {
  tagFilter: string | null;
  onTagFilterChange: (tag: string | null) => void;
  allTags: string[];
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export default function Toolbar({ tagFilter, onTagFilterChange, allTags, onExpandAll, onCollapseAll }: ToolbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex h-10 shrink-0 items-center justify-between px-6">
      <div className="relative flex items-center gap-2" ref={dropdownRef}>
        <button
          className={`flex h-7 items-center gap-1.5 rounded px-2.5 transition-colors ${
            tagFilter
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'text-[var(--muted)] hover:bg-[var(--surface)]'
          }`}
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <Tag className="size-[14px]" strokeWidth={1.5} />
          <span className="text-[11px] font-medium">
            {tagFilter ? `TAG: ${tagFilter}` : 'TAG FILTER ▾'}
          </span>
        </button>

        {showDropdown && (
          <div className="absolute top-8 left-0 z-50 max-h-60 min-w-[140px] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl">
            <button
              className="flex w-full items-center px-3 py-1.5 text-left text-[11px] text-[var(--muted)] hover:bg-[var(--background)]"
              onClick={() => { onTagFilterChange(null); setShowDropdown(false); }}
            >
              All (no filter)
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`flex w-full items-center px-3 py-1.5 text-left text-[11px] hover:bg-[var(--background)] ${
                  tagFilter === tag ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
                }`}
                onClick={() => { onTagFilterChange(tag); setShowDropdown(false); }}
              >
                {tag}
              </button>
            ))}
            {allTags.length === 0 && (
              <span className="block px-3 py-1.5 text-[11px] text-[var(--muted)]">No tags</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onExpandAll}
          className="flex h-7 items-center rounded px-2.5 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--surface)]"
        >
          EXPAND
        </button>
        <button
          onClick={onCollapseAll}
          className="flex h-7 items-center rounded px-2.5 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--surface)]"
        >
          COLLAPSE
        </button>
      </div>
    </div>
  );
}
