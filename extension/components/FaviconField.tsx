import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { resolveFaviconUrl } from '@/lib/favicon';

interface FaviconFieldProps {
  value: string;
  onChange: (url: string) => void;
  pageUrl: string;
  title?: string;
}

export default function FaviconField({ value, onChange, pageUrl, title }: FaviconFieldProps) {
  const [previewError, setPreviewError] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const letter = (title || pageUrl || '?')[0]?.toUpperCase() || '?';
  const showImg = Boolean(value.trim()) && !previewError;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const resolved = await resolveFaviconUrl(pageUrl, value);
      if (resolved) {
        setPreviewError(false);
        onChange(resolved);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Icon</label>
      <div className="flex items-center gap-2">
        {showImg ? (
          <img
            src={value}
            alt=""
            className="size-6 shrink-0 rounded-sm"
            onError={() => setPreviewError(true)}
            onLoad={() => setPreviewError(false)}
          />
        ) : (
          <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-[var(--muted)]/20 text-[10px] font-bold text-[var(--muted)]">
            {letter}
          </div>
        )}
        <input
          type="url"
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
          value={value}
          onChange={(e) => {
            setPreviewError(false);
            onChange(e.target.value);
          }}
          placeholder="Icon URL (optional)"
        />
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing || !pageUrl.trim()}
          className="flex shrink-0 items-center gap-1 rounded border border-[var(--border)] px-2.5 py-2 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50"
          title="Probe public icon CDNs for this URL"
        >
          <RefreshCw className={`size-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync icon'}
        </button>
      </div>
    </div>
  );
}
