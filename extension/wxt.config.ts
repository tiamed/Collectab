import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    // Keep loro out of dep pre-bundling so the base64 entry's inlined WASM stays intact.
    optimizeDeps: {
      exclude: ['loro-crdt'],
    },
  }),
  manifest: {
    name: 'Collectab',
    description: 'A Toby-like bookmark manager with organizations, collections, and real-time sync',
    permissions: ['bookmarks', 'tabs', 'storage'],
  },
});
