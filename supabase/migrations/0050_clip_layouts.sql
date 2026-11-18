-- AI clipping, clipper look: "1 word" captions in the Anton face, thin TikTok titles, and new layouts
-- (auto, facecam + gameplay, two cams + gameplay, speaker tracking, zoom on blur). `framing` keeps what the in-browser
-- face detection found (src/lib/clipFraming.ts) so it runs once per clip; `divider` draws the neon line between panels.
alter table clips drop constraint if exists clips_layout_check;
alter table clips add constraint clips_layout_check check (layout in ('auto','split','stack','track','zoom','fill','fit'));
alter table clips alter column layout set default 'auto';

alter table clips drop constraint if exists clips_caption_style_check;
alter table clips add constraint clips_caption_style_check check (caption_style in ('clipper','bold','pop','clean'));
alter table clips alter column caption_style set default 'clipper';

alter table clips drop constraint if exists clips_caption_anim_check;
alter table clips add constraint clips_caption_anim_check check (caption_anim in ('word','karaoke','pop','none'));
alter table clips alter column caption_anim set default 'word';

alter table clips drop constraint if exists clips_title_style_check;
alter table clips add constraint clips_title_style_check check (title_style in ('tiktok','box','outline','neon'));
alter table clips alter column title_style set default 'tiktok';

alter table clips alter column caption_pos set default 520;

alter table clips add column if not exists framing jsonb;
alter table clips add column if not exists divider boolean not null default true;
grant update (framing, divider) on clips to authenticated;
