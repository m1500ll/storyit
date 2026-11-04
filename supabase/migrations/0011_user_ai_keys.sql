-- Bring-your-own Gemini API key. The key is AES-GCM encrypted by the Edge Function (TOKEN_ENCRYPTION_KEY)
-- and never readable from the browser: no RLS policy at all, every access goes through the `prompts` function.
create table if not exists user_ai_keys (
  user_id uuid primary key references profiles on delete cascade,
  provider text not null default 'gemini' check (provider = 'gemini'),
  key_enc text not null,
  key_hint text not null,                  -- last 4 characters, for display
  status text not null default 'valid' check (status in ('valid', 'invalid', 'no_billing')),
  last_error text,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table user_ai_keys enable row level security;
revoke all on user_ai_keys from anon, authenticated;
