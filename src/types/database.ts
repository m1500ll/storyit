/**
 * Supabase database types. Mirrors supabase/migrations/0001_init.sql.
 * Regenerate with: npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */

export type StoryStatus = 'draft' | 'concept_selected' | 'scenes_ready' | 'generating' | 'in_review' | 'approved' | 'published';
export type SceneStatus = 'pending' | 'queued' | 'generating' | 'generated' | 'failed';
/** Render pipeline step (server-side). */
export type RenderStage = 'pending' | 'image' | 'video_submit' | 'video_wait' | 'audio' | 'done' | 'failed';
export type CreditTransactionType = 'purchase' | 'subscription_grant' | 'consumption' | 'refund' | 'bonus';
export type AspectRatio = '9:16' | '1:1' | '16:9';

type Timestamp = string; // ISO-8601
type UUID = string;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: UUID; display_name: string | null; plan: 'free' | 'creator' | 'studio'; credit_balance: number; created_at: Timestamp };
        Insert: { id: UUID; display_name?: string | null; plan?: 'free' | 'creator' | 'studio'; credit_balance?: number };
        Update: { display_name?: string | null; plan?: 'free' | 'creator' | 'studio' };
        Relationships: [];
      };
      stories: {
        Row: {
          id: UUID;
          user_id: UUID;
          title: string;
          idea: string;
          logline: string | null;
          genre: string;
          aspect_ratio: AspectRatio;
          status: StoryStatus;
          episode_number: number;
          series_id: UUID | null;
          approved_at: Timestamp | null;
          approved_hash: string | null;
          render_started_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID; user_id: UUID; title: string; idea: string; logline?: string | null; genre?: string;
          aspect_ratio?: AspectRatio; status?: StoryStatus; episode_number?: number; series_id?: UUID | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['stories']['Row'], 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      characters: {
        Row: {
          id: UUID; story_id: UUID; name: string; species: string; personality: string;
          visual_description: string; voice_style: string | null; reference_image_url: string | null; created_at: Timestamp;
        };
        Insert: Omit<Database['public']['Tables']['characters']['Row'], 'id' | 'created_at'> & { id?: UUID };
        Update: Partial<Omit<Database['public']['Tables']['characters']['Row'], 'id' | 'story_id' | 'created_at'>>;
        Relationships: [];
      };
      scenes: {
        Row: {
          id: UUID; story_id: UUID; position: number; title: string; narration: string; dialogue: string | null;
          image_prompt: string; video_prompt: string; duration_seconds: number; status: SceneStatus;
          image_url: string | null; video_url: string | null; character_ids: UUID[]; error_message: string | null;
          stage: RenderStage; image_path: string | null; video_path: string | null; audio_path: string | null;
          operation: string | null; attempts: number; claimed_at: Timestamp | null;
          updated_at: Timestamp;
        };
        Insert: Omit<Database['public']['Tables']['scenes']['Row'],
          'id' | 'updated_at' | 'status' | 'image_url' | 'video_url' | 'error_message' | 'stage' | 'image_path' | 'video_path' | 'audio_path' | 'operation' | 'attempts' | 'claimed_at'> & {
          id?: UUID; status?: SceneStatus;
        };
        Update: Partial<Omit<Database['public']['Tables']['scenes']['Row'], 'id' | 'story_id'>>;
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: UUID; user_id: UUID; type: CreditTransactionType; amount: number; balance_after: number;
          story_id: UUID | null; description: string; created_at: Timestamp;
        };
        Insert: Omit<Database['public']['Tables']['credit_transactions']['Row'], 'id' | 'created_at' | 'balance_after'>;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_credits: { Args: { p_amount: number; p_story_id: string | null; p_description: string }; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type Tables = Database['public']['Tables'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];

export type Profile = Row<'profiles'>;
export type Story = Row<'stories'>;
export type Character = Row<'characters'>;
export type Scene = Row<'scenes'>;
export type CreditTransaction = Row<'credit_transactions'>;
