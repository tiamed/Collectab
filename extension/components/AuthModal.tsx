import { useState } from 'react';
import { X } from 'lucide-react';
import type { User } from '@/lib/api';

interface AuthModalProps {
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<User>;
  onRegister: (email: string, password: string, name: string) => Promise<User>;
}

export default function AuthModal({ onClose, onLogin, onRegister }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)]" onClick={onClose}>
      <form
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h3>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Name</label>
              <input
                type="text"
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Email</label>
            <input
              type="email"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Password</label>
            <input
              type="password"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
              required
              minLength={mode === 'register' ? 8 : undefined}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[11px] text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded bg-[var(--success)] py-2 text-xs font-medium text-[#12121a] disabled:opacity-50"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={() => setMode('register')} className="text-[var(--success)] hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-[var(--success)] hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
