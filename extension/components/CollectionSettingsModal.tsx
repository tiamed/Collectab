import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import type { Collection } from '@/lib/api';
import EmojiIconPicker from './EmojiIconPicker';

interface CollectionSettingsModalProps {
  collection: Collection;
  onSave: (updates: { name?: string; icon?: string }) => Promise<void>;
  onClose: () => void;
}

export default function CollectionSettingsModal({ collection, onSave, onClose }: CollectionSettingsModalProps) {
  const mousedownOnBackdropRef = useRef(false);
  const [name, setName] = useState(collection.name);
  const [icon, setIcon] = useState(collection.icon);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: name.trim() !== collection.name ? name.trim() : undefined,
        icon: icon !== collection.icon ? icon : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mousedownOnBackdropRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!mousedownOnBackdropRef.current) return;
    mousedownOnBackdropRef.current = false;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)]" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <form
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Collection Settings</h3>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Name</label>
            <input
              type="text"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <EmojiIconPicker value={icon} onChange={setIcon} />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
