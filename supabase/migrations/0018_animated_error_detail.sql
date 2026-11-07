-- Technical reason of a failed animated short (stack trace from the render worker), for diagnosis. The customer sees
-- only the short `error`; the `animated-studio` Edge Function never returns this column.
alter table animated_projects add column if not exists error_detail text;
