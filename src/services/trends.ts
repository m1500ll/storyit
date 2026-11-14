// Daily trend reports ("veille") for the Creative Studio: read directly (RLS: signed-in read); imported by the admin
// through the `trends` Edge Function, which parses the pasted report.
import { supabase } from '@/lib/supabase';
import { store } from './store';

export interface TrendConcept {
  id: string; day: string; number: number; title: string; kind: 'hit' | 'variant'; fr_status: 'green' | 'orange' | 'red' | null;
  header: string | null; stats: string | null; cast_text: string | null; hook: string | null; outline: string | null; ending: string | null;
  cover: string | null; caption: string | null; repeat_line: string | null; screen_line: string | null;
}
export interface TrendDay { day: string; insights: string; concepts: TrendConcept[] }

export const trends = {
  /** the latest report and its concepts (empty when none was imported yet) */
  async latest(): Promise<TrendDay | null> {
    if (!supabase) return null;
    const { data: rep } = await supabase.from('trend_reports' as never).select('day, insights').order('day', { ascending: false }).limit(1).maybeSingle();
    const r = rep as { day: string; insights: string } | null;
    if (!r) return null;
    const { data } = await supabase.from('trend_concepts' as never)
      .select('id, day, number, title, kind, fr_status, header, stats, cast_text, hook, outline, ending, cover, caption, repeat_line, screen_line')
      .eq('day', r.day).order('number');
    return { day: r.day, insights: r.insights, concepts: (data ?? []) as unknown as TrendConcept[] };
  },
  async days(): Promise<{ day: string }[]> {
    if (!supabase) return [];
    const { data } = await supabase.from('trend_reports' as never).select('day').order('day', { ascending: false }).limit(30);
    return (data ?? []) as unknown as { day: string }[];
  },
  async import(report: string, day: string) {
    if (!supabase) throw new Error('Mode démo.');
    const { data, error } = await supabase.functions.invoke<{ day: string; concepts: number; hits: number; green: number; without_hook: number[]; insights_chars: number }>('trends', { body: { action: 'import', report, day } });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const payload = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }) : {};
      throw new Error(payload.error ?? error.message);
    }
    store.notify();
    return data!;
  },
};
