import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Collectab',
    description: 'A Toby-like bookmark manager with organizations, collections, and real-time sync',
    permissions: ['bookmarks', 'tabs', 'storage'],
  },
});
