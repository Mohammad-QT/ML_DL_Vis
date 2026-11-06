import type { APIRoute } from 'astro';
import { CLASSIFICATION, PREP, REGRESSION, SELECTION, lessonPath, prepPath, regPath, selPath } from '../lessons';
import { href } from '../i18n/ui';

/** Every public page in both languages, each with hreflang alternates. */
const PATHS = ['', 'compare/', ...PREP.map(prepPath), ...REGRESSION.map(regPath), ...CLASSIFICATION.map(lessonPath), ...SELECTION.map(selPath)];

export const GET: APIRoute = ({ site }) => {
  const abs = (lang: 'en' | 'ar', p: string) => new URL(href(lang, p), site).href;
  const urls = PATHS.flatMap(p => (['en', 'ar'] as const).map(l =>
    `  <url><loc>${abs(l, p)}</loc><xhtml:link rel="alternate" hreflang="en" href="${abs('en', p)}"/><xhtml:link rel="alternate" hreflang="ar" href="${abs('ar', p)}"/></url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
