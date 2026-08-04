import { useState, useEffect, useRef } from 'react';

interface DeleteOrgModalProps {
  isOpen: boolean;
  orgName: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteOrgModal({ isOpen, orgName, onConfirm, onClose }: DeleteOrgModalProps) {
  const mousedownOnBackdropRef = useRef(false);
  const [typedName, setTypedName] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedName('');
      setStep(1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const nameMatches = typedName === orgName;

  const handleFirstConfirm = () => {
    if (nameMatches) {
      setStep(2);
    }
  };

  const handleFinalConfirm = () => {
    onConfirm();
    onClose();
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--backdrop)]" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div
        className="w-full max-w-sm rounded-lg border border-red-500/30 bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 ? (
          <>
            <h3 className="mb-2 text-sm font-semibold text-red-400">Delete Organization</h3>
            <p className="mb-1 text-xs text-[var(--foreground)]">
              This will permanently delete <strong>{orgName}</strong> and all its spaces, collections, and bookmarks.
            </p>
            <p className="mb-4 text-xs text-[var(--muted)]">
              Type the organization name to confirm:
            </p>

            <input
              ref={inputRef}
              type="text"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-red-400"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={orgName}
              onKeyDown={(e) => { if (e.key === 'Enter' && nameMatches) handleFirstConfirm(); }}
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]"
              >
                Cancel
              </button>
              <button
                onClick={handleFirstConfirm}
                disabled={!nameMatches}
                className="rounded bg-red-500 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-30"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-semibold text-red-400">Are you absolutely sure?</h3>
            <p className="mb-4 text-xs text-[var(--foreground)]">
              This action is <strong>irreversible</strong>. All data inside <strong>{orgName}</strong> will be permanently deleted.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalConfirm}
                className="rounded bg-red-600 px-4 py-1.5 text-xs font-medium text-white"
              >
                Delete Forever
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
