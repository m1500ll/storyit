-- Creator outreach (owner only, through the `outreach` Edge Function): TikTok creators to invite into the partner
-- programme. Messages are sent by hand from TikTok (copy + open profile): no automated DMs (TikTok forbids them).
create table if not exists outreach_creators (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  display_name text,
  followers integer,
  niche text,
  notes text,
  status text not null default 'to_contact' check (status in ('to_contact', 'contacted', 'replied', 'partner', 'declined')),
  message text,
  follow_up_count integer not null default 0,
  contacted_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
alter table outreach_creators enable row level security;
revoke all on outreach_creators from anon, authenticated;

-- the creators the owner pointed out (Nov 2026), minus the ones already in the partner programme
insert into outreach_creators (handle, niche) values
  ('premierchapiitre', 'Fruits IA'), ('salade2fruitsai', 'Fruits IA'), ('lenivuniconnu', 'Fruits IA'), ('lemondedesfruites', 'Fruits IA'),
  ('agentai.story.fr', 'Histoires IA'), ('lacordefeel', 'Fruits IA'), ('fruitstroyia', 'Fruits IA'), ('fruitpop021', 'Fruits IA'),
  ('delire2fruits', 'Fruits IA'), ('lovedrama479', 'Drama IA')
on conflict (handle) do nothing;
