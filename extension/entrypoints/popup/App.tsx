import { useState, useEffect } from 'react';
import { Button, Separator, TextField, Label, Input } from '@heroui/react';
import { Bookmark, Check, FolderOpen, Layers } from 'lucide-react';

export default function App() {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [tabCount, setTabCount] = useState(0);
  const [sessionSaved, setSessionSaved] = useState(false);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab) {
        setTitle(tab.title || '');
        setUrl(tab.url || '');
      }
    });
    browser.tabs.query({ currentWindow: true }).then((tabs) => {
      setTabCount(tabs.length);
    });
  }, []);

  const handleSave = () => {
    // TODO: Save via Loro CRDT + sync to server
    setSaved(true);
    setTimeout(() => window.close(), 800);
  };

  const handleSaveSession = async () => {
    const response = await browser.runtime.sendMessage({ type: 'SAVE_SESSION' });
    if (response?.success) {
      setSessionSaved(true);
      setTimeout(() => window.close(), 800);
    }
  };

  if (saved || sessionSaved) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6">
        <div className="flex size-10 items-center justify-center rounded-full bg-success/20">
          <Check className="size-5 text-success" />
        </div>
        <p className="text-sm font-medium">
          {sessionSaved ? `${tabCount} tabs saved!` : 'Bookmark saved!'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Bookmark className="size-4 text-accent" />
        <h1 className="text-sm font-semibold">Save Bookmark</h1>
      </div>

      <TextField value={title} onChange={setTitle}>
        <Label>Title</Label>
        <Input />
      </TextField>

      <TextField value={url} onChange={setUrl}>
        <Label>URL</Label>
        <Input />
      </TextField>

      <Button variant="primary" size="sm" onPress={handleSave}>
        <FolderOpen className="size-4" />
        Save to Collection
      </Button>

      <Separator />

      <Button variant="tertiary" size="sm" onPress={handleSaveSession} className="w-full">
        <Layers className="size-4" />
        Save All Tabs ({tabCount})
      </Button>
    </div>
  );
}
