-- can_view_checkin looks the row up by id, but a row being inserted isn't there yet, and
-- INSERT ... ON CONFLICT also checks the SELECT policy. So owners are matched on the row itself.
drop policy read_by_visibility on public.event_checkins;
create policy read_by_visibility on public.event_checkins for select to authenticated
using (user_id = (select auth.uid()) or public.can_view_checkin(id));
