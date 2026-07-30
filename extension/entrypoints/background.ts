export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('Toby-like Bookmark extension installed');
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

    // TODO: Create collection + bookmarks via Loro CRDT and sync to server
    // For now, store in extension local storage
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
