import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex size-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface)]"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="size-[14px]" strokeWidth={1.5} />
      ) : (
        <Moon className="size-[14px]" strokeWidth={1.5} />
      )}
    </button>
  );
}
