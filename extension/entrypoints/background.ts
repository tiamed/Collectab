import { CrdtSyncClient } from '@/lib/crdt-sync-port';

const syncClient = new CrdtSyncClient();
const ports = new Set<{ postMessage: (msg: unknown) => void; onMessage: { addListener: (fn: (msg: any) => void) => void }; onDisconnect: { addListener: (fn: () => void) => void }; disconnect?: () => void }>();

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('Collectab extension installed');
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'crdt-sync') return;
    ports.add(port);

    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case 'CRDT_CONNECT':
          syncClient.connect(msg.spaceId as string, (update) => {
            for (const p of ports) {
              try {
                p.postMessage({ type: 'CRDT_UPDATE', update: Array.from(update) });
              } catch {
                // port disconnected
              }
            }
          });
          port.postMessage({ type: 'CRDT_CONNECTED' });
          break;

        case 'CRDT_SEND':
          syncClient.send(new Uint8Array(msg.update as number[]));
          break;

        case 'CRDT_DISCONNECT':
          syncClient.disconnect();
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      ports.delete(port);
      if (ports.size === 0) syncClient.disconnect();
    });
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SAVE_SESSION') {
      handleSaveSession().then(sendResponse);
      return true;
    }

    if (message.type === 'GET_SYNC_STATUS') {
      sendResponse({ connected: false });
    }

    return true;
  });
});

async function handleSaveSession(): Promise<{ success: boolean; collectionId?: string }> {
  try {
    const tabs = await browser.tabs.query({ currentWindow: true });

    const bookmarks = tabs
      .filter((tab) => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:'))
      .map((tab) => ({
        title: tab.title || tab.url || 'Untitled',
        url: tab.url!,
        favicon: tab.favIconUrl || '',
      }));

    if (bookmarks.length === 0) {
      return { success: false };
    }

    const now = new Date();
    const collectionName = `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const stored = await browser.storage.local.get('sessions');
    const sessions: any[] = (stored.sessions as any[]) || [];
    const newSession = {
      id: crypto.randomUUID(),
      name: collectionName,
      bookmarks,
      createdAt: now.toISOString(),
    };
    sessions.push(newSession);
    await browser.storage.local.set({ sessions });

    return { success: true, collectionId: newSession.id };
  } catch (err) {
    console.error('Failed to save session:', err);
    return { success: false };
  }
}
