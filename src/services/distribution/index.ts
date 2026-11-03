import { supabase } from '@/lib/supabase';
import { createMockDistribution } from './mockDistribution';
import { createSupabaseDistribution } from './supabaseDistribution';

export const distribution = supabase ? createSupabaseDistribution(supabase) : createMockDistribution();
export * from './types';
export { videoState, VIDEO_STATE_LABEL } from './videoState';
