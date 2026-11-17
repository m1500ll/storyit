-- AI clipping: captions the customer can tune (size, height on screen, animation) and the title look.
alter table clips add column if not exists caption_size smallint not null default 100 check (caption_size between 60 and 150);
alter table clips add column if not exists caption_pos smallint not null default 300 check (caption_pos between 120 and 760);
alter table clips add column if not exists caption_anim text not null default 'karaoke' check (caption_anim in ('none', 'pop', 'karaoke'));
alter table clips add column if not exists title_style text not null default 'box' check (title_style in ('box', 'outline', 'neon'));
grant update (caption_size, caption_pos, caption_anim, title_style) on clips to authenticated;
