// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://mohammad-qt.github.io',
  base: '/ML_DL_Vis/',
  output: 'static',
  integrations: [mdx()],
  trailingSlash: 'always',
  i18n: {
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
});
