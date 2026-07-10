import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://houman.top',
  integrations: [],
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ['sharp'],
    },
  },
});