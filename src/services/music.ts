// "Importer ma musique" in the video wizard: the customer's own track, stored privately (bucket `music`, own folder).
import { supabase } from '@/lib/supabase';

export const MUSIC_MAX_BYTES = 15 * 1024 * 1024;
export const MUSIC_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg'];

/** uploads the file and returns the option value the wizard sends ('upload:<uid>/<file>') */
export async function uploadMusic(file: File): Promise<string> {
  if (!supabase) throw new Error('L’import de musique a besoin du serveur Storyit (mode démo).');
  if (file.size > MUSIC_MAX_BYTES) throw new Error('Fichier trop lourd : 15 Mo maximum.');
  if (file.type && !MUSIC_TYPES.includes(file.type)) throw new Error('Format non pris en charge : MP3, M4A, WAV ou OGG.');
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Veuillez vous reconnecter.');
  const ext = (file.name.split('.').pop() ?? 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'mp3';
  const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('music').upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: false });
  if (error) throw new Error('L’import a échoué, réessayez.');
  return `upload:${path}`;
}
