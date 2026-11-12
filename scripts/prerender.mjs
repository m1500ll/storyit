// Pre-renders the public pages into real HTML after `vite build` (see src/entry-server.tsx): dist/index.html (home),
// dist/privacy.html, dist/terms.html, each with its own title, description, canonical URL and, for the home
// page, the FAQ and video structured data. Every other path (the app) is still the single-page app: a tiny inline
// script empties the pre-rendered home markup before the first paint when the address is not the page's own.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { render, ROUTES, pageMeta } = await import(join(root, 'dist-ssr', 'entry-server.js'));
const SITE = 'https://www.storyit.fun';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
if (!/<div id="root">[\s\S]*?<\/div>\s*<\/body>/.test(template)) throw new Error('prerender: <div id="root"> not found in dist/index.html');

for (const route of ROUTES) {
  const m = pageMeta(route, SITE);
  const url = SITE + route;
  const own = route === '/' ? '' : route;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(m.description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(m.title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(m.description)}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(m.title)}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${esc(m.description)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/<div id="root">[\s\S]*?<\/div>(\s*<\/body>)/, (_all, tail) => `<div id="root">${render(route)}</div>`
      + `<script>(function(){var p=location.pathname.replace(/\\/+$/,'');if(p!=='${own}'){var r=document.getElementById('root');if(r)r.innerHTML='';}})();</script>${tail}`);
  const head = m.alternates.map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}" />`).join('')
    + (m.jsonLd.length ? `<script type="application/ld+json">${JSON.stringify(m.jsonLd).replace(/</g, '\\u003c')}</script>` : '');
  html = html.replace('</head>', `${head}</head>`).replace('<html lang="en">', `<html lang="${m.lang}">`)
    .replace(/(<meta property="og:locale" content=")[^"]*/, `$1${m.lang === 'fr' ? 'fr_FR' : 'en_US'}`);
  // /privacy → dist/privacy.html: served at /privacy by Vercel (cleanUrls) and Cloudflare (auto-trailing-slash)
  const out = route === '/' ? join(dist, 'index.html') : join(dist, `${route.slice(1)}.html`); // /fr/x → dist/fr/x.html
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`prerendered ${route} (${Math.round(html.length / 1024)} KB)`);
}
// sitemap: the search pages (with their other-language version) added to public/sitemap.xml's home and legal pages
const smPath = join(dist, 'sitemap.xml');
const today = new Date().toISOString().slice(0, 10);
const extra = ROUTES.filter((r) => !['/', '/privacy', '/terms'].includes(r)).map((r) => {
  const m = pageMeta(r, SITE);
  const alts = m.alternates.map((a) => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>`).join('');
  return `  <url><loc>${SITE}${r}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${r === '/fr' ? '0.9' : '0.8'}</priority>${alts}</url>`;
}).join('\n');
writeFileSync(smPath, readFileSync(smPath, 'utf8')
  .replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  .replace('</urlset>', `${extra}\n</urlset>`));
console.log(`sitemap: ${ROUTES.length} pages`);
rmSync(join(root, 'dist-ssr'), { recursive: true, force: true });
