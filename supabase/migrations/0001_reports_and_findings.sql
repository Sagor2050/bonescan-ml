-- Reports, findings, and their files (Plan B.1). Row-level security means the
-- database itself refuses a report to anyone but its owner (NFR8).

-- An account can't store reports until its email is confirmed (S6.1). auth.users
-- can't be read by patients, so this runs with the rights of its owner.
create function public.email_is_confirmed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and email_confirmed_at is not null
  );
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('pdf', 'pasted')),
  file_path text not null default '',
  raw_text text not null,
  -- A day of leeway, because the patient's today can be ahead of the server's.
  exam_date date not null check (exam_date <= current_date + 1),
  exam_date_source text not null check (exam_date_source in ('report', 'patient')),
  added_at timestamptz not null default now()
);
create index reports_owner_order on public.reports (user_id, exam_date, added_at);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  -- Keeps the report's order. uuids and identical timestamps can't.
  position integer not null default 0,
  bone text not null default '',
  side text not null default '' check (side in ('left', 'right', '')),
  part text[] not null default '{}',
  type_words text[] not null default '{}',
  certainty text not null check (certainty in ('certain', 'uncertain')),
  healing_words text[] not null default '{}',
  status text not null check (
    status in ('placed', 'outside_coverage', 'side_not_stated', 'bone_not_stated')
  ),
  wording jsonb not null default '[]',
  entered_by_patient boolean not null default false
);
create index findings_report on public.findings (report_id, position);

alter table public.reports enable row level security;
alter table public.findings enable row level security;

create policy "owners read their reports" on public.reports
  for select to authenticated using (user_id = auth.uid());
create policy "confirmed owners add reports" on public.reports
  for insert to authenticated
  with check (user_id = auth.uid() and public.email_is_confirmed());
create policy "owners change their reports" on public.reports
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners delete their reports" on public.reports
  for delete to authenticated using (user_id = auth.uid());

-- Whether the signed-in account owns a report. Findings policies use this.
create function public.owns_report(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports
    where id = target and user_id = auth.uid()
  );
$$;

create policy "owners read their findings" on public.findings
  for select to authenticated using (public.owns_report(report_id));
create policy "owners add findings" on public.findings
  for insert to authenticated with check (public.owns_report(report_id));
create policy "owners change their findings" on public.findings
  for update to authenticated
  using (public.owns_report(report_id)) with check (public.owns_report(report_id));
create policy "owners delete their findings" on public.findings
  for delete to authenticated using (public.owns_report(report_id));

-- The report itself is never edited (NFR4). Only its exam date can change (S1.2).
revoke all on public.reports, public.findings from anon, authenticated;
grant select, insert, delete on public.reports to authenticated;
grant update (exam_date, exam_date_source) on public.reports to authenticated;
grant select, insert, delete on public.findings to authenticated;
-- A finding's wording stays as the report wrote it. Which report it belongs to
-- can't change either.
grant update (
  position, bone, side, part, type_words, certainty, healing_words, status,
  entered_by_patient
) on public.findings to authenticated;

-- Original PDFs, at {user_id}/{report_id}.pdf. Files are never changed (NFR4).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 10485760, array['application/pdf']);

create policy "owners read their files" on storage.objects
  for select to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "confirmed owners add files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.email_is_confirmed()
  );
create policy "owners delete their files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deletes the signed-in account and, through the cascades, all of its rows
-- (S6.3). The web app removes the account's files first. It must have signed in
-- again within the last five minutes, which is what the token's age checks.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if coalesce((auth.jwt() ->> 'iat')::bigint, 0)
     < extract(epoch from now())::bigint - 300 then
    raise exception 'Sign in again to delete your account';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.email_is_confirmed() from public, anon;
grant execute on function public.email_is_confirmed() to authenticated;
revoke all on function public.owns_report(uuid) from public, anon;
grant execute on function public.owns_report(uuid) to authenticated;
