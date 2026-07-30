import { useState, useEffect } from 'react';
import { X, UserPlus, Crown, Trash2 } from 'lucide-react';
import { getSpaceMembers, addSpaceMember, removeSpaceMember, updateMemberRole } from '@/lib/api';
import type { SpaceMember } from '@/lib/api';

interface MembersModalProps {
  spaceId: string;
  spaceName: string;
  onClose: () => void;
}

export default function MembersModal({ spaceId, spaceName, onClose }: MembersModalProps) {
  const [owner, setOwner] = useState<{ id: string; email: string; name: string } | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      const data = await getSpaceMembers(spaceId);
      setOwner(data.owner);
      setMembers(data.members);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, [spaceId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addSpaceMember(spaceId, email.trim(), role);
      setEmail('');
      fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    await removeSpaceMember(spaceId, userId);
    fetchMembers();
  };

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer') => {
    await updateMemberRole(spaceId, userId, newRole);
    fetchMembers();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)]" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Members — {spaceName}</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </button>
        </div>

        {/* Add member form */}
        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground)] outline-none"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="flex items-center gap-1 rounded bg-[var(--success)] px-3 py-2 text-xs font-medium text-[#12121a] disabled:opacity-50"
          >
            <UserPlus className="size-3" />
            Add
          </button>
        </form>

        {error && <p className="mb-3 text-[11px] text-red-400">{error}</p>}

        {/* Member list */}
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {loading && <p className="text-xs text-[var(--muted)]">Loading...</p>}

          {owner && (
            <div className="flex items-center justify-between rounded bg-[var(--background)] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-[var(--success)] text-[10px] font-bold text-[#12121a]">
                  {owner.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground)]">{owner.name}</p>
                  <p className="text-[10px] text-[var(--muted)]">{owner.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#f59e0b]">
                <Crown className="size-3" />
                Owner
              </div>
            </div>
          )}

          {members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between rounded px-3 py-2 hover:bg-[var(--background)]">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-[var(--background)] text-[10px] font-bold text-[var(--muted)]">
                  {member.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground)]">{member.name}</p>
                  <p className="text-[10px] text-[var(--muted)]">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.userId, e.target.value as 'editor' | 'viewer')}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  onClick={() => handleRemove(member.userId)}
                  className="text-[var(--muted)] hover:text-red-400"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}

          {!loading && members.length === 0 && (
            <p className="py-2 text-center text-xs text-[var(--muted)]">No members yet</p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
