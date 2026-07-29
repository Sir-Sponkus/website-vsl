import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';


const repoName = process.env.REPO_NAME 
  ? `/${process.env.REPO_NAME.replace(/^\/+|\/+$/g, '')}` 
  : '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html', // Required for SPA static export
      precompress: false,
      strict: false
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? repoName : ''
    }
  }
};

export default config;