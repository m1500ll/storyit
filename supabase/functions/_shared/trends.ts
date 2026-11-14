/**
 * Parser of the daily trend report ("veille") the owner pastes. Pure: used by the `trends` Edge Function and the tests.
 * The report lists concepts as "#N — Title | origin | status", then lines starting with emoji markers:
 * 📊 stats · 👥 cast · 🪝 Hook: (block) · 🎬 Déroulé: (block) · 🔚 Fin de la vidéo · 🖼️ Couverture · ✍️ Légende ·
 * 🔁 À répéter · 💬 À l'écran · 🔗 link. Part 1 (before the concepts) is kept as the day's insights.
 */
export type TrendConcept = {
  number: number; title: string; kind: 'hit' | 'variant'; fr_status: 'green' | 'orange' | 'red' | null; header: string;
  stats: string; cast_text: string; hook: string; outline: string; ending: string; cover: string; caption: string;
  repeat_line: string; screen_line: string; source_url: string;
};

const MARKERS: [keyof TrendConcept, RegExp][] = [
  ['stats', /^📊\s*/u], ['cast_text', /^👥\s*/u], ['hook', /^🪝\s*(Hook\s*:)?\s*/iu], ['outline', /^🎬\s*(Déroulé\s*:)?\s*/iu],
  ['ending', /^🔚\s*(Fin de la vidéo\s*:)?\s*/iu], ['cover', /^🖼️?\s*(Couverture\s*:)?\s*/iu], ['caption', /^✍️?\s*(Légende\s*:)?\s*/iu],
  ['repeat_line', /^🔁\s*(À répéter\s*:)?\s*/iu], ['screen_line', /^💬\s*(À l['’]écran\s*:)?\s*/iu], ['source_url', /^🔗\s*/u],
];
const HEAD = /^#(\d{1,3})\s*[—–-]\s*(.+?)\s*(?:\|\s*(.*))?$/u;

export function parseTrendReport(raw: string): { insights: string; concepts: TrendConcept[] } {
  const text = raw.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const firstConcept = lines.findIndex((l) => HEAD.test(l.trim()));
  const intro = (firstConcept < 0 ? lines : lines.slice(0, firstConcept)).join('\n');
  // insights: Part 1 only (stop at "PARTIE 2" when present), without the separator lines
  const cut = intro.search(/PARTIE\s*2/i);
  const insights = (cut > 0 ? intro.slice(0, cut) : intro).split('\n').filter((l) => !/^[━─=_\-\s]+$/.test(l)).join('\n').trim().slice(0, 12000);
  const concepts: TrendConcept[] = [];
  let cur: TrendConcept | null = null;
  let field: keyof TrendConcept | null = null;
  const push = () => { if (cur) concepts.push(cur); };
  for (const rawLine of firstConcept < 0 ? [] : lines.slice(firstConcept)) {
    const l = rawLine.trim();
    const h = HEAD.exec(l);
    if (h) {
      push();
      const header = (h[3] ?? '').trim();
      const status = header.includes('🟢') ? 'green' : header.includes('🟠') ? 'orange' : header.includes('🔴') ? 'red' : null;
      cur = { number: Number(h[1]), title: h[2]!.trim(), kind: /variante/i.test(header) ? 'variant' : 'hit', fr_status: status, header,
        stats: '', cast_text: '', hook: '', outline: '', ending: '', cover: '', caption: '', repeat_line: '', screen_line: '', source_url: '' };
      field = null;
      continue;
    }
    if (!cur || !l || /^[━─=_\s]+$/.test(l) || /^[🔥🧪]\s*LES\s/u.test(l)) continue;
    const m = MARKERS.find(([, re]) => re.test(l));
    if (m) {
      field = m[0];
      const rest = l.replace(m[1], '').trim();
      (cur as Record<string, unknown>)[field] = rest;
      continue;
    }
    if (field && field !== 'source_url') {
      const prev = String(cur[field] ?? '');
      (cur as Record<string, unknown>)[field] = prev ? `${prev}\n${l}` : l;
    }
  }
  push();
  for (const c of concepts) for (const k of Object.keys(c) as (keyof TrendConcept)[]) if (typeof c[k] === 'string') (c as Record<string, unknown>)[k] = String(c[k]).slice(0, 4000);
  return { insights, concepts };
}

/** the story text a concept prefills in the Creative Studio (French, ready to adapt) */
export function conceptToStory(c: Pick<TrendConcept, 'title' | 'cast_text' | 'hook' | 'outline' | 'ending' | 'repeat_line' | 'screen_line'>): string {
  return [
    `Concept : ${c.title}`,
    c.cast_text && `Personnages et lieu : ${c.cast_text}`,
    c.hook && `Hook :\n${c.hook}`,
    c.outline && `Déroulé :\n${c.outline}`,
    c.ending && `Fin (cliffhanger) : ${c.ending}`,
    c.repeat_line && `Réplique à répéter (partages) : ${c.repeat_line}`,
    c.screen_line && `Jeu pour les commentaires : ${c.screen_line}`,
  ].filter(Boolean).join('\n\n').slice(0, 3000);
}
