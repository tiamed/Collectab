import IconDisplay from './IconDisplay';

interface EmojiIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export default function EmojiIconPicker({ value, onChange }: EmojiIconPickerProps) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Icon</label>
      <div className="flex items-center gap-2">
        <IconDisplay
          icon={value}
          className="flex size-7 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--background)] text-sm"
          imgClassName="size-5 rounded object-contain"
        />
        <input
          type="text"
          className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Emoji, text, or image URL"
        />
      </div>
    </div>
  );
}
