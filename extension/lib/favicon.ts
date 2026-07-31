const PROBE_TIMEOUT_MS = 6000;

/** Extract hostname from a page URL; null if invalid. */
export function hostnameFromUrl(pageUrl: string): string | null {
  try {
    return new URL(pageUrl).hostname || null;
  } catch {
    return null;
  }
}

/** Candidate favicon URLs for a bookmark (current value first, then public icon CDNs). */
export function faviconCandidates(pageUrl: string, currentFavicon?: string | null): string[] {
  const host = hostnameFromUrl(pageUrl);
  if (!host) return currentFavicon?.trim() ? [currentFavicon.trim()] : [];

  const candidates: string[] = [];
  const current = currentFavicon?.trim();
  if (current) candidates.push(current);
  candidates.push(
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
    `https://icon.horse/icon/${host}`,
  );
  return [...new Set(candidates)];
}

function probeImage(src: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = src;
  });
}

/**
 * Probe candidates with <img> (not fetch) so CORP/CORS-restricted origin icons
 * fail cleanly without false negatives. Returns the first URL that loads, or null.
 */
export async function resolveFaviconUrl(
  pageUrl: string,
  currentFavicon?: string | null,
): Promise<string | null> {
  const candidates = faviconCandidates(pageUrl, currentFavicon);
  if (candidates.length === 0) return null;

  for (const src of candidates) {
    if (await probeImage(src)) return src;
  }
  return null;
}
