import { describe, expect, it } from 'vitest';
import { buildFixPrompt, buildPhasePrompt, buildReviewPrompt, checklist, clipStats, coverPrompt, FIX_PROBLEMS, grokPrompt, imagePrompt, MASTER_PROMPT, normalizePhase, PHASES, senseProblems, sheetPrompt, STYLES, words } from '@shared/promptStudio.ts';

const line = (character: string, start: number, end: number, text: string) => ({ character, start, end, text });
const W = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(' ');
// a 10-second clip at a natural 2.9 words/s: 29 words in 3 lines, contiguous, ends 0.2 s before the end
const clip10 = () => ({ seconds: 10, location: 'kitchen', characters: ['Kévin', 'Lila'], summary: 's', open_question: 'q', new_thing: 'n', mini_hook: 'm',
  lines: [line('Kévin', 0.1, 3.3, W(10)), line('Lila', 3.4, 6.6, W(10)), line('Kévin', 6.7, 9.8, W(9))] });
const script = () => normalizePhase('script', {
  title: 'Le billet déchiré', paradox: 'p', synopsis: 's',
  characters: [{ name: 'Kévin', phonetic: 'Ké-vin', head: 'big glossy watermelon head', face: 'f', hands_neck: 'green', outfit: 'red hoodie', accessory: 'cap', voice: 'young street voice', role: 'héros' },
    { name: 'Lila', phonetic: 'Li-la', head: 'angular lemon head', face: 'f', hands_neck: 'yellow', outfit: 'black suit', accessory: 'ring', voice: 'cold sharp voice', role: 'méchante' }],
  locations: ['kitchen'], hook_candidates: [1, 2, 3, 4, 5].map((i) => ({ mechanic: `m${i}`, line: 'l' })), hook: { image: 'i', why: 'w' }, backup_hooks: [{ image: 'a', line: 'b' }, { image: 'c', line: 'd' }],
  clips: Array.from({ length: 7 }, clip10), cliffhanger: 'c',
  engagement: { levers: ['a'], references: ['Jul', 'Squid Game'], cult_line: 'c', target_comment: 't', scores: { villain: 2, debate: 2, cult_line: 2, share: 1, part2: 2, detail: 1 } },
});

describe('Creative Studio V4', () => {
  it('master prompt keeps the key rules of the meta-prompt', () => {
    for (const rule of ['durée totale imposée', '2,6-3,2 mots/s', '5 mots minimum', 'PHRASE FRANÇAISE COMPLÈTE', '5 hooks', 'cliffhanger', 'Grille /10', 'HISTOIRE ET RYTHME']) expect(MASTER_PROMPT).toContain(rule);
  });
  it('the story is enough to start: the script step needs no concepts', () => {
    expect(PHASES.script.requires).toEqual([]);
    expect(PHASES.videos.requires).toEqual(expect.arrayContaining(['script', 'images']));
    expect(buildPhasePrompt('script', { style: 'ongles', story: 'Un ongle rouge vole un contrat', feedback: 'plus drôle' })).toMatch(/Ongles[\s\S]*Un ongle rouge vole un contrat[\s\S]*plus drôle/);
    expect(buildPhasePrompt('script', { style: 'fruits', part: 2, previous_end: 'la porte claque', story: 'x' })).toContain('PARTIE 2');
  });
  it('counts words and pace per clip', () => {
    expect(words('« Cent mille euros pour dormir chez moi ?! »')).toBe(7);
    const st = clipStats(clip10());
    expect(st.words).toBe(29);
    expect(st.wps).toBeCloseTo(2.9);
    expect(st.short).toBe(0);
  });
  it('clip lengths snap to 6, 10 or 15 s and unusable answers are rejected (no credit charged)', () => {
    expect(normalizePhase('script', { clips: [7, 11, 14, 30].map((s) => ({ ...clip10(), seconds: s })) }).clips.map((c: { seconds: number }) => c.seconds)).toEqual([6, 10, 15, 15]);
    expect(() => normalizePhase('script', { clips: [clip10()] })).toThrow(/trop court/);
    expect(() => normalizePhase('concepts', { concepts: [] })).toThrow();
  });
  it('spots broken lines: cut in the middle, padded with a filler word, repeated word', () => {
    const bad = { clips: [{ seconds: 10, lines: [
      line('Lila', 0.1, 3, 'Treize âmes piégées, aucune ne sortira vivante ici maintenant absolument'),
      line('Maël', 3.1, 6, 'Regarde ton reflet, il porte le sceau de l’obscurité dans les'),
      line('Kévin', 6.1, 9.8, 'Tu as signé le contrat sans même le lire, Lila.'),
    ] }] };
    const issues = senseProblems(bad);
    expect(issues.map((i) => i.issue)).toEqual(['mot de remplissage en fin de phrase', 'phrase coupée au milieu']);
    const review = buildReviewPrompt(bad);
    expect(review).toContain('RELECTEUR');
    expect(review).toContain('phrase coupée au milieu');
    expect(review).toContain('2,6 à 3,2 mots/s');
  });
  it('the checklist passes a clean 70 s script and flags the problems', () => {
    const s = script();
    const ok = checklist({ style: 'fruits', script: s });
    expect(ok.find((c) => c.label.startsWith('Durée'))!.ok).toBe(true);
    expect(ok.find((c) => c.label.startsWith('Rythme'))!.ok).toBe(true);
    const slow = { ...s, clips: s.clips.map((c: ReturnType<typeof clip10>, i: number) => (i === 2 ? { ...c, lines: [line('Kévin', 0.1, 9.8, W(12))] } : c)) };
    expect(checklist({ style: 'fruits', script: slow }).find((c) => c.label.startsWith('Rythme'))!.detail).toContain('clip 3');
  });
  it('image prompts copy the character sheet and the full style block word for word', () => {
    const d = { style: 'pierres', script: script(), images: { sheet: [{ name: 'Kévin', description: 'big ruby head, red hoodie' }, { name: 'Lila', description: 'sapphire head, black suit' }], clips: [{ setting: 'a kitchen', continuity: 'stain on the hoodie', characters: [{ name: 'Kévin', action: 'tearing a ticket' }, { name: 'Lila', action: 'pointing' }] }] } };
    expect(sheetPrompt(d)).toContain('2 characters standing side by side');
    expect(sheetPrompt(d).endsWith(STYLES.pierres.block)).toBe(true);
    const img = imagePrompt(d, 0);
    expect(img).toContain('Same characters as the attached character reference sheet.');
    expect(img).toContain('KÉVIN, big ruby head, red hoodie, tearing a ticket');
    expect(img).toContain('Both fully visible');
    expect(img).toContain('stain on the hoodie');
    expect(img.endsWith(STYLES.pierres.block)).toBe(true);
  });
  it('Grok prompts carry the 8 blocks, the timed French dialogue, voices and pronunciation', () => {
    const d = { style: 'fruits', script: script(), videos: { clips: [{ head_lock: [{ name: 'Kévin', head: 'watermelon' }, { name: 'Lila', head: 'lemon' }], look_lock: '', shots: [{ start: 0, end: 3.3, text: 'push-in on KÉVIN TALKING' }], sound: 'kitchen ambience, a slap at 0.0s' }] } };
    const g = grokPrompt(d, 0);
    for (const b of ['① Animate this image: 10-second', 'glossy whole fruit heads, never cut', '② HEAD LOCK: KÉVIN and LILA', '③ SPEAKER LOCK', '④ PACE', '⑤ Camera always moving', '⑥ SHOT LIST:', '⑦ DIALOGUE (in French, spoken clearly at a natural pace, word for word):', '⑧ PRONUNCIATION: "Kévin" = "Ké-vin"', 'No music, no subtitles, no text.']) expect(g).toContain(b);
    expect(g).toMatch(/KÉVIN \(young street voice\) 0\.1-3\.\ds: «/);
    expect(g).toContain('LILA (cold sharp voice)');
    expect(g).toContain('Fast push-in from the very first frame'); // clip 1 only
  });
  it('cover, hashtags and the troubleshooting list', () => {
    const d = { style: 'fruits', part: 2, script: script(), pack: normalizePhase('pack', { cover: { setting: 's', glow: 'red', characters: [{ name: 'Kévin', pose: 'crying' }, { name: 'Lila', pose: 'smirking' }] }, caption: 'c', pinned_comment: 'Team Kévin ou Team Lila ?', hashtags: ['#a1', 'b2 c3', '#d4', 'e5', 'f6', 'a1'] }) };
    expect(d.pack.hashtags).toHaveLength(5);
    expect(coverPrompt(d)).toContain('« PARTIE 2 »');
    expect(coverPrompt(d)).toContain('3:4 vertical format');
    expect(Object.keys(FIX_PROBLEMS)).toEqual(expect.arrayContaining(['slow', 'speaker', 'look', 'hook']));
    expect(buildFixPrompt({ style: 'fruits', script: script() }, 2, 'speaker', '')).toContain('clip 3');
  });
});
