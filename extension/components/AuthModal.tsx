import { useState, useRef } from 'react';
import { X, Server } from 'lucide-react';
import { getApiBase, setApiBase } from '@/lib/api';
import type { User } from '@/lib/api';

interface AuthModalProps {
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<User>;
  onRegister: (email: string, password: string, name: string) => Promise<User>;
}

export default function AuthModal({ onClose, onLogin, onRegister }: AuthModalProps) {
  const mousedownOnBackdropRef = useRef(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState(getApiBase());
  const [showServer, setShowServer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHint(null);
    setLoading(true);
    try {
      const trimmed = serverUrl.trim().replace(/\/+$/, '');
      if (trimmed && trimmed !== getApiBase()) {
        await setApiBase(trimmed);
        // Session/cache cleared; continue to login on the new server
      }

      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name);
      }
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Request failed';
      setError(msg);

      const isNetwork =
        /failed to fetch|network|econnrefused|timeout|load failed/i.test(msg) ||
        msg === 'Failed to fetch';
      const isAuth =
        /invalid|unauthorized|not found|incorrect|credentials|401|403/i.test(msg);

      if (mode === 'login') {
        if (isNetwork) {
          setHint('Cannot reach the server. Check the Server URL below, or make sure your server is running.');
          setShowServer(true);
        } else if (isAuth) {
          setHint('Wrong email or password? Or create an account if you haven\'t registered yet.');
        } else {
          setHint('Login failed. Check your Server URL, or register a new account.');
          setShowServer(true);
        }
      } else if (isNetwork) {
        setHint('Cannot reach the server. Check the Server URL below.');
        setShowServer(true);
      }
    } finally {
      setLoading(false);
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

          {/* Server URL */}
          <div>
            <button
              type="button"
              onClick={() => setShowServer(!showServer)}
              className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Server className="size-3" />
              Server URL
              <span className="text-[9px] opacity-60">{showServer ? '▲' : '▼'}</span>
            </button>
            {showServer && (
              <input
                type="url"
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:3001/api"
              />
            )}
            {!showServer && (
              <p className="truncate text-[10px] text-[var(--muted)]">{serverUrl}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-[11px] text-red-400">{error}</p>
            {hint && <p className="mt-1 text-[10px] text-red-300/80">{hint}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded bg-[var(--accent)] py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setHint(null); }}
                className="text-[var(--accent)] hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setHint(null); }}
                className="text-[var(--accent)] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
