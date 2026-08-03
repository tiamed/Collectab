import { Check } from 'lucide-react';

const COLORS = [
  '#9761da', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#10b981', '#06b6d4', '#3b82f6',
  '#6366f1', '#ec4899', '#64748b', '#000000',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Color</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {COLORS.map((color) => {
          const selected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={`flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                selected ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface)]' : ''
              }`}
              style={{ backgroundColor: color }}
              title={color}
              aria-label={`Color ${color}`}
            >
              {selected && <Check className="size-3 text-white" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
