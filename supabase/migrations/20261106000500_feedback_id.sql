-- The feedback function picks the id itself, to link the GitHub issue afterwards.
grant insert (id) on public.feedback to authenticated;
