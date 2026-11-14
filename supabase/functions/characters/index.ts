// Supabase Edge Function: `characters` — customers create their own reusable characters ("Mes personnages").
// - list: the caller's characters (newest first), each with a short-lived link to its reference sheet
// - create { universe, description, photo? (data URL, optional), consent? }: charges CHARACTER_COST credits, writes the
//   look with ChatGPT, then draws the reference sheet in the background (OpenAI image); refunded if anything fails
// - idea { universe }: one-sentence character idea (free)
// - delete { id }
// Secrets: OPENAI_API_KEY (the writer model comes from OPENAI_MODEL, see _shared/backupLlm.ts).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { backupText, openaiModels } from '../_shared/backupLlm.ts';
import { CHARACTER_COST, characterSheetPrompt, isUniverse, UNIVERSES, type Universe } from '../_shared/characters.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const COLS = 'id, universe, description, name, role, personality, voice, look, sheet_path, status, error, created_at';
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

const LOOK_SCHEMA = { type: 'OBJECT', properties: {
  name: { type: 'STRING', description: 'Un vrai prénom humain court, facile à prononcer en français' },
  role: { type: 'STRING', description: 'Son rôle en 2 à 4 mots (ex. « La méchante jalouse »)' },
  personality: { type: 'STRING', description: '3 traits de caractère en français, séparés par des virgules' },
  voice: { type: 'STRING', description: 'Sa voix en français (timbre, débit), 4 à 8 mots' },
  look: { type: 'STRING', description: 'IN ENGLISH, 60 to 110 words: age, gender, build and height, face (realistic adult features), skin (and its material if any), hair, eyes, complete signature outfit with colors, one accessory. No brand, no logo, no text, no real person, no copyrighted character.' },
}, required: ['name', 'role', 'personality', 'voice', 'look'] };

async function write(system: string, prompt: string, schema: unknown) {
  for (const m of openaiModels()) {
    try { const r = await backupText(m, system, prompt, schema, 45_000); if (r) return r; } catch (e) { console.error('writer', m.model, e instanceof Error ? e.message : e); }
  }
  throw new Error('writer unavailable');
}

async function drawSheet(prompt: string, photo: { bytes: Uint8Array; type: string } | null): Promise<Uint8Array> {
  const key = Deno.env.get('OPENAI_API_KEY')!;
  let res: Response;
  if (photo) {
    const form = new FormData();
    form.append('model', 'gpt-image-1.5'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'high');
    form.append('output_format', 'jpeg'); form.append('output_compression', '88'); form.append('n', '1');
    form.append('image[]', new Blob([photo.bytes], { type: photo.type }), `photo.${photo.type.split('/')[1]}`);
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(300_000) });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', signal: AbortSignal.timeout(300_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1.5', prompt, size: '1536x1024', quality: 'high', output_format: 'jpeg', output_compression: 88, n: 1 }) });
  }
  const d = await res.json();
  if (!res.ok || !d?.data?.[0]?.b64_json) throw new Error(String(d?.error?.message ?? res.status));
  return Uint8Array.from(atob(d.data[0].b64_json), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: { action?: string; id?: string; universe?: string; description?: string; photo?: string; consent?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const uid = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (body.action === 'list') {
    const { data } = await admin.from('user_characters').select(COLS).eq('user_id', uid).order('created_at', { ascending: false }).limit(100);
    const rows = data ?? [];
    const paths = rows.map((r) => r.sheet_path).filter(Boolean) as string[];
    const { data: signed } = paths.length ? await admin.storage.from('characters').createSignedUrls(paths, 3600) : { data: [] };
    const url = (p: string | null) => (p ? signed?.find((s) => s.path === p)?.signedUrl ?? null : null);
    return json({ characters: rows.map((r) => ({ ...r, sheet_url: url(r.sheet_path) })) });
  }

  if (body.action === 'delete') {
    const { data: row } = await admin.from('user_characters').select('id, sheet_path, status').eq('id', body.id ?? '').eq('user_id', uid).maybeSingle();
    if (!row) return json({ error: 'Personnage introuvable.' }, 404);
    if (row.status === 'generating') return json({ error: 'Attendez la fin du dessin avant de le supprimer.' }, 409);
    if (row.sheet_path) await admin.storage.from('characters').remove([row.sheet_path]);
    await admin.from('user_characters').delete().eq('id', row.id);
    return json({ ok: true });
  }

  if (body.action === 'idea') {
    const u: Universe = isUniverse(body.universe) ? body.universe : 'humains';
    try {
      const r: any = await write('Tu inventes des personnages originaux pour des mini-séries TikTok virales.',
        `Univers : ${UNIVERSES[u].label} (${UNIVERSES[u].hint}). Propose UN personnage original et marquant en une phrase française de 10 à 18 mots (métier ou situation, un trait fort, un détail visuel, un secret ou un défaut). Exemple : « ${UNIVERSES[u].example} ». Aucune célébrité, aucun personnage existant, aucune marque.`,
        { type: 'OBJECT', properties: { idea: { type: 'STRING' } }, required: ['idea'] });
      return json({ idea: str(r?.idea, 300) });
    } catch { return json({ error: 'Le service est très demandé : réessayez dans un instant.' }, 502); }
  }

  if (body.action !== 'create') return json({ error: 'Action inconnue' }, 400);
  if (!Deno.env.get('OPENAI_API_KEY')) return json({ error: 'La création de personnages n’est pas encore disponible.' }, 503);
  if (!isUniverse(body.universe)) return json({ error: 'Choisissez un univers.' }, 400);
  const universe = body.universe;
  const description = str(body.description, 800);
  if (description.length < 8) return json({ error: 'Décrivez votre personnage en une phrase.' }, 400);
  let photo: { bytes: Uint8Array; type: string } | null = null;
  if (body.photo) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(body.photo);
    if (!m) return json({ error: 'Photo : PNG, JPEG ou WebP uniquement.' }, 400);
    if (!body.consent) return json({ error: 'Confirmez que vous avez le droit d’utiliser cette photo.' }, 400);
    photo = { type: m[1], bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
    if (photo.bytes.length > 5 * 1024 * 1024) return json({ error: 'Photo trop lourde (5 Mo maximum).' }, 400);
  }
  const { count } = await admin.from('user_characters').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'generating');
  if ((count ?? 0) >= 2) return json({ error: 'Deux personnages sont déjà en cours de dessin : attendez qu’ils soient prêts.' }, 429);

  // the look first (free if it fails), then the charge, then the drawing in the background
  let look: any;
  try {
    look = await write('Tu es directeur artistique d’un studio de mini-séries 3D verticales. Tu crées des personnages originaux, adultes, avec un visage humain réaliste.',
      `Univers : ${UNIVERSES[universe].label} — ${UNIVERSES[universe].hint}.${universe === 'perso' ? ' Le client décrit lui-même le style : respecte-le à la lettre.' : ''}\nDescription du client : « ${description} »${photo ? '\nLe client fournit une photo de référence : décris une tenue et un style, mais PAS les traits du visage (ils viennent de la photo).' : ''}\nCrée la fiche du personnage. Le prénom doit être original (jamais celui d’une célébrité ou d’un personnage connu).`, LOOK_SCHEMA);
  } catch { return json({ error: 'Le service est très demandé : réessayez dans un instant. Aucun crédit n’a été utilisé.' }, 502); }
  const fields = { name: str(look?.name, 40) || 'Sans nom', role: str(look?.role, 80), personality: str(look?.personality, 200), voice: str(look?.voice, 120), look: str(look?.look, 1200) };
  if (!fields.look) return json({ error: 'Réessayez : la fiche du personnage est revenue vide. Aucun crédit n’a été utilisé.' }, 502);

  const { error: payErr } = await user.rpc('consume_credits', { p_amount: CHARACTER_COST, p_story_id: null, p_description: `Création du personnage ${fields.name}` });
  if (payErr) return json({ error: /insufficient/.test(payErr.message) ? 'Crédits insuffisants : rechargez votre solde pour créer ce personnage.' : 'Paiement impossible, réessayez.' }, 402);
  const { data: row, error: insErr } = await admin.from('user_characters').insert({ user_id: uid, universe, description, ...fields, status: 'generating', credits_charged: CHARACTER_COST }).select(COLS).single();
  if (insErr || !row) {
    await admin.rpc('grant_credits', { p_user_id: uid, p_amount: CHARACTER_COST, p_type: 'refund', p_description: 'Création de personnage — remboursement' });
    return json({ error: 'Impossible d’enregistrer le personnage. Vos crédits ont été rendus.' }, 500);
  }

  EdgeRuntime.waitUntil((async () => {
    try {
      const jpg = await drawSheet(characterSheetPrompt(universe, fields.look, !!photo), photo);
      const path = `${uid}/${row.id}.jpg`;
      const up = await admin.storage.from('characters').upload(path, jpg, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw new Error(up.error.message);
      await admin.from('user_characters').update({ status: 'ready', sheet_path: path }).eq('id', row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('character sheet', row.id, msg);
      await admin.from('user_characters').update({ status: 'failed', credits_charged: 0,
        error: /safety|moderation/i.test(msg) ? 'Le dessin a été refusé par le filtre de sécurité : changez la description.' : 'Le dessin a échoué. Vos crédits ont été rendus : réessayez.' }).eq('id', row.id);
      await admin.rpc('grant_credits', { p_user_id: uid, p_amount: CHARACTER_COST, p_type: 'refund', p_description: `Personnage ${fields.name} — remboursement` });
    }
  })());
  return json({ character: { ...row, sheet_url: null } });
});
