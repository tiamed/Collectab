export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Extract page metadata for bookmark enrichment when requested
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PAGE_META') {
        const meta = {
          title: document.title,
          description:
            document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content || '',
          favicon:
            document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ||
            document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]')?.href ||
            `${window.location.origin}/favicon.ico`,
        };
        sendResponse(meta);
      }
      return true;
    });
  },
});
