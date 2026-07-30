import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Toby-like Bookmark',
    description: 'Bookmark manager with collections and real-time sync',
    permissions: ['bookmarks', 'tabs', 'storage'],
  },
});
