/** Cross-context signal: popup (or any page) → open newtab refreshes bookmarks. */

export const BOOKMARKS_CHANGED_KEY = 'bookmarks_changed_v1';

export type BookmarksChangedEvent = {
  at: number;
  spaceId?: string | null;
  collectionId?: string | null;
};

/** Bump a shared storage key so other extension pages can refetch. */
export async function notifyBookmarksChanged(
  event: Omit<BookmarksChangedEvent, 'at'> = {},
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({
    [BOOKMARKS_CHANGED_KEY]: { ...event, at: Date.now() } satisfies BookmarksChangedEvent,
  }).catch(() => {});
}

/** Subscribe to bookmark mutations from other extension pages. */
export function subscribeBookmarksChanged(
  listener: (event: BookmarksChangedEvent) => void,
): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => {};

  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local') return;
    const change = changes[BOOKMARKS_CHANGED_KEY];
    if (!change?.newValue) return;
    listener(change.newValue as BookmarksChangedEvent);
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
