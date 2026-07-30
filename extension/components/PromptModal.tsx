import { useState, useEffect, useRef } from 'react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export default function PromptModal({
  isOpen,
  title,
  label,
  placeholder,
  defaultValue = '',
  onSubmit,
  onClose,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--backdrop)]" onClick={onClose}>
      <form
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">{title}</h3>

        <div>
          {label && <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">{label}</label>}
          <input
            ref={inputRef}
            type="text"
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
}
