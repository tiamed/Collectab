import { useState, useRef } from 'react';
import { X, Upload, Download } from 'lucide-react';
import { getApiBase, setApiBase, importFromNiceTab, importFromToby, importNative, exportData } from '@/lib/api';

interface SettingsModalProps {
  onClose: () => void;
  onImportDone?: () => void;
  activeOrgId?: string | null;
  activeOrgName?: string;
  onDeleteAllSpaces?: () => void;
}

export default function SettingsModal({ onClose, onImportDone, activeOrgId, activeOrgName = 'Personal', onDeleteAllSpaces }: SettingsModalProps) {
  const [serverUrl, setServerUrl] = useState(getApiBase());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const niceTabInputRef = useRef<HTMLInputElement>(null);
  const tobyInputRef = useRef<HTMLInputElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setStatus('idle');
    try {
      await setApiBase(serverUrl.trim());
      const res = await fetch(serverUrl.trim().replace(/\/api$/, '') + '/health');
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, format: 'nicetab' | 'toby' | 'native') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let result;
      if (format === 'native') {
        result = await importNative(data, activeOrgId);
      } else if (format === 'nicetab') {
        result = await importFromNiceTab(data, activeOrgId);
      } else {
        result = await importFromToby(data, activeOrgId);
      }
      setImportStatus(
        `Imported ${result.stats.spacesCreated} spaces, ${result.stats.collectionsCreated} collections, ${result.stats.bookmarksCreated} bookmarks`,
      );
      onImportDone?.();
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`);
    } finally {
      setImporting(false);
      if (niceTabInputRef.current) niceTabInputRef.current.value = '';
      if (tobyInputRef.current) tobyInputRef.current.value = '';
      if (nativeInputRef.current) nativeInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportStatus(null);
    try {
      const data = await exportData(activeOrgId);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      const safeName = activeOrgName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
      a.download = `bookmarks-${safeName}-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus(`Exported ${data.spaces.length} spaces`);
    } catch (err: any) {
      setExportStatus(`Error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)]" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Settings</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Server URL */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Server URL</label>
            <p className="mb-2 text-[10px] text-[var(--muted)]">
              Point to your self-hosted server's API endpoint
            </p>
            <input
              type="url"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--accent)]"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000/api"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-[#12121a] disabled:opacity-50"
              >
                {saving ? 'Testing...' : 'Save & Test'}
              </button>
              {status === 'success' && (
                <span className="text-[11px] text-[var(--success)]">Connected</span>
              )}
              {status === 'error' && (
                <span className="text-[11px] text-red-400">Connection failed</span>
              )}
            </div>
          </div>

          {/* Export */}
          <div className="border-t border-[var(--border)] pt-4">
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Export Data</label>
            <p className="mb-2 text-[10px] text-[var(--muted)]">
              Export all spaces, collections, and bookmarks from the current context as JSON
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
            >
              <Download className="size-3.5" />
              {exporting ? 'Exporting...' : 'Export JSON'}
            </button>
            {exportStatus && (
              <p className={`mt-2 text-[11px] ${exportStatus.startsWith('Error') ? 'text-red-400' : 'text-[var(--success)]'}`}>
                {exportStatus}
              </p>
            )}
          </div>

          {/* Import */}
          <div className="border-t border-[var(--border)] pt-4">
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Import Data</label>
            <p className="mb-2 text-[10px] text-[var(--muted)]">
              Import bookmarks from a previous export, NiceTab, or Toby (JSON)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => nativeInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 rounded border border-[var(--accent)]/30 bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
              >
                <Upload className="size-3.5" />
                {importing ? 'Importing...' : 'From Export'}
              </button>
              <button
                onClick={() => niceTabInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
              >
                <Upload className="size-3.5" />
                {importing ? 'Importing...' : 'NiceTab'}
              </button>
              <button
                onClick={() => tobyInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
              >
                <Upload className="size-3.5" />
                {importing ? 'Importing...' : 'Toby'}
              </button>
              <input
                ref={nativeInputRef}
                type="file"
                accept=".json"
                onChange={(e) => handleImport(e, 'native')}
                className="hidden"
              />
              <input
                ref={niceTabInputRef}
                type="file"
                accept=".json"
                onChange={(e) => handleImport(e, 'nicetab')}
                className="hidden"
              />
              <input
                ref={tobyInputRef}
                type="file"
                accept=".json"
                onChange={(e) => handleImport(e, 'toby')}
                className="hidden"
              />
            </div>
            {importStatus && (
              <p className={`mt-2 text-[11px] ${importStatus.startsWith('Error') ? 'text-red-400' : 'text-[var(--success)]'}`}>
                {importStatus}
              </p>
            )}
          </div>

          {/* Account section */}
          <div className="border-t border-[var(--border)] pt-4">
            <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Account</label>
            <p className="text-[10px] text-[var(--muted)]">
              Logged in via token stored in extension storage.
            </p>
          </div>

          {/* Danger zone */}
          {onDeleteAllSpaces && (
            <div className="border-t border-red-500/30 pt-4">
              <label className="mb-1 block text-[11px] font-medium text-red-400">Danger Zone</label>
              {!showDeleteAll ? (
                <button
                  onClick={() => setShowDeleteAll(true)}
                  className="rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Delete All Spaces
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-[var(--muted)]">
                    Type <strong className="text-red-400">DELETE ALL</strong> to confirm
                  </p>
                  <input
                    type="text"
                    className="w-full rounded border border-red-500/30 bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-red-400"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE ALL"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeleteAll(false); setDeleteConfirmText(''); }}
                      className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { onDeleteAllSpaces(); onClose(); }}
                      disabled={deleteConfirmText !== 'DELETE ALL'}
                      className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-30"
                    >
                      Delete All Spaces
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
