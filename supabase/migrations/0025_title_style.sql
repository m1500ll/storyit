-- Animated Studio: the customer picks the style of the big hook title shown at the start of the video.
alter table animated_projects add column if not exists title_style text not null default 'choc'
  check (title_style in ('choc', 'bandeau', 'cinema'));
