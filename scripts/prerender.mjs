// Pre-renders the public pages into real HTML after `vite build` (see src/entry-server.tsx): dist/index.html (home),
// dist/privacy.html, dist/terms.html, each with its own title, description, canonical URL and, for the home
// page, the FAQ and video structured data. Every other path (the app) is still the single-page app: a tiny inline
// script empties the pre-rendered home markup before the first paint when the address is not the page's own.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { render, ROUTES, homeJsonLd } = await import(join(root, 'dist-ssr', 'entry-server.js'));
const SITE = 'https://storyit.fun';
const META = {
  '/': {
    title: 'Storyit — AI Video Generator for Viral TikTok Videos (3D & Fruit Dramas)',
    description: 'Create viral AI videos that earn money: 3D animated true stories and Fruit Drama mini-series, with voice, music and captions, ready for TikTok, Reels and Shorts. Translate any video in one click. Start free.',
  },
  '/privacy': { title: 'Privacy Policy — Storyit', description: 'How Storyit collects, uses and protects your data.' },
  '/terms': { title: 'Terms of Service — Storyit', description: 'The terms that apply when you use Storyit.' },
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
if (!/<div id="root">[\s\S]*?<\/div>\s*<\/body>/.test(template)) throw new Error('prerender: <div id="root"> not found in dist/index.html');

for (const route of ROUTES) {
  const m = META[route];
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
    .replace(/<div id="root">[\s\S]*?<\/div>(\s*<\/body>)/, () => `<div id="root">${render(route)}</div>`
      + `<script>(function(){var p=location.pathname.replace(/\\/+$/,'');if(p!=='${own}'){var r=document.getElementById('root');if(r)r.innerHTML='';}})();</script>$1`);
  if (route === '/') html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(homeJsonLd(SITE)).replace(/</g, '\\u003c')}</script></head>`);
  // /privacy → dist/privacy.html: served at /privacy by Vercel (cleanUrls) and Cloudflare (auto-trailing-slash)
  const out = route === '/' ? join(dist, 'index.html') : join(dist, `${route.slice(1)}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`prerendered ${route} (${Math.round(html.length / 1024)} KB)`);
}
rmSync(join(root, 'dist-ssr'), { recursive: true, force: true });
