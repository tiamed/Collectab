import { useState } from 'react';
import { X } from 'lucide-react';

interface AddBookmarkModalProps {
  collectionId: string;
  onSave: (params: { collectionId: string; title: string; url: string; description?: string; tags?: string[] }) => Promise<void>;
  onClose: () => void;
}

export default function AddBookmarkModal({ collectionId, onSave, onClose }: AddBookmarkModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await onSave({
        collectionId,
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)]" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Add Bookmark</h3>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="URL" value={url} onChange={setUrl} type="url" placeholder="https://..." autoFocus />
          <Field label="Title" value={title} onChange={setTitle} placeholder="Page title" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Optional" />
          <Field label="Tags" value={tags} onChange={setTags} placeholder="comma separated" />
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
            disabled={saving || !title.trim() || !url.trim()}
            className="rounded bg-[var(--success)] px-4 py-1.5 text-xs font-medium text-[#12121a] disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, autoFocus }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{label}</label>
      <input
        type={type}
        className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </div>
  );
}
