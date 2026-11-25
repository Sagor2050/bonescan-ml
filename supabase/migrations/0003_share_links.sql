-- Links a patient makes to share chosen reports with family or a caretaker
-- (S10.1). Only a hash of each link's token is kept, so nobody can rebuild a link
-- from the database, and the patient sees the link only once.
--
-- Patients read their links through row-level security, but every change goes
-- through the functions below, which check ownership themselves.

create extension if not exists pgcrypto with schema extensions;

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  -- share_token_hash() of the token. The token itself is never stored.
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  -- Null means the link never expires.
  expires_at timestamptz,
  -- Set when the patient turns the link off. It can't be turned back on.
  revoked_at timestamptz
);
create index share_links_owner on public.share_links (owner_user_id, created_at);

-- A deleted report drops out of every link that covered it.
create table public.share_link_reports (
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  primary key (share_link_id, report_id)
);
create index share_link_reports_report on public.share_link_reports (report_id);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Null means new links never expire. An account with no row uses 30.
  default_share_expiry_days integer default 30
    check (default_share_expiry_days in (1, 7, 14, 30, 90))
);

alter table public.share_links enable row level security;
alter table public.share_link_reports enable row level security;
alter table public.user_settings enable row level security;

create policy "owners read their share links" on public.share_links
  for select to authenticated using (owner_user_id = auth.uid());
create policy "owners read what their share links cover" on public.share_link_reports
  for select to authenticated using (
    exists (
      select 1 from public.share_links
      where id = share_link_id and owner_user_id = auth.uid()
    )
  );
create policy "owners read their settings" on public.user_settings
  for select to authenticated using (user_id = auth.uid());

revoke all on public.share_links, public.share_link_reports, public.user_settings
  from anon, authenticated;
grant select on public.share_links, public.share_link_reports, public.user_settings
  to authenticated;

-- The one way to hash a token, so the patient side and the public viewer agree.
-- The hash is lowercase hex SHA-256 of the token's text.
create function public.share_token_hash(token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;

-- Whether a link still opens its reports. It must not be turned off or expired,
-- and must still cover at least one report. Every check of a link uses this.
create function public.share_link_is_active(link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.share_links as link
    where link.id = link_id
      and link.revoked_at is null
      and (link.expires_at is null or link.expires_at > now())
      and exists (
        select 1 from public.share_link_reports as covered
        where covered.share_link_id = link.id
      )
  );
$$;

-- When a link made now with this choice expires. Null means never.
create function public.share_expiry_from_now(days integer)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if days is null then
    return null;
  end if;
  if days not in (1, 7, 14, 30, 90) then
    raise exception 'Choose 1, 7, 14, 30, or 90 days, or never'
      using errcode = 'check_violation';
  end if;
  return now() + make_interval(days => days);
end;
$$;

-- The signed-in account's default expiry for new links, in days. Null means never.
create function public.my_default_share_expiry()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days integer;
begin
  select default_share_expiry_days into days
  from public.user_settings
  where user_id = auth.uid();
  if not found then
    return 30;
  end if;
  return days;
end;
$$;

create function public.set_default_share_expiry(days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  perform public.share_expiry_from_now(days);
  insert into public.user_settings (user_id, default_share_expiry_days)
  values (auth.uid(), days)
  on conflict (user_id) do update
    set default_share_expiry_days = excluded.default_share_expiry_days;
end;
$$;

-- Makes a link to some of the signed-in account's own reports. Returns the token
-- once. With use_default_expiry, the account's default replaces expires_in_days.
create function public.create_share_link(
  report_ids uuid[],
  expires_in_days integer default null,
  use_default_expiry boolean default false
)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  days integer := expires_in_days;
  new_token text;
  link public.share_links;
begin
  if owner is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(cardinality(report_ids), 0) = 0 then
    raise exception 'Choose at least one report' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from unnest(report_ids) as chosen (report_id)
    where chosen.report_id is null or not exists (
      select 1 from public.reports as report
      where report.id = chosen.report_id and report.user_id = owner
    )
  ) then
    raise exception 'You can only share your own reports'
      using errcode = 'insufficient_privilege';
  end if;
  if use_default_expiry then
    days := public.my_default_share_expiry();
  end if;

  -- 32 random bytes as base64url without padding.
  new_token := rtrim(
    translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  );
  insert into public.share_links (owner_user_id, token_hash, expires_at)
  values (owner, public.share_token_hash(new_token), public.share_expiry_from_now(days))
  returning * into link;
  insert into public.share_link_reports (share_link_id, report_id)
  select distinct link.id, chosen.report_id
  from unnest(report_ids) as chosen (report_id);

  return query select link.id, new_token, link.expires_at;
end;
$$;

-- Sets a new expiry, counted from now. A link that is turned off stays off.
create function public.set_share_link_expiry(link_id uuid, expires_in_days integer)
returns table (
  id uuid, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.share_links;
begin
  update public.share_links as target
  set expires_at = public.share_expiry_from_now(expires_in_days)
  where target.id = link_id
    and target.owner_user_id = auth.uid()
    and target.revoked_at is null
  returning * into link;
  if link.id is null then
    raise exception 'This link can''t be changed'
      using errcode = 'insufficient_privilege';
  end if;
  return query select link.id, link.created_at, link.expires_at, link.revoked_at;
end;
$$;

-- Turns a link off for good, starting now.
create function public.revoke_share_link(link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.share_links as target
  set revoked_at = coalesce(target.revoked_at, now())
  where target.id = link_id and target.owner_user_id = auth.uid();
  if not found then
    raise exception 'This link can''t be changed'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function
  public.share_token_hash(text),
  public.share_link_is_active(uuid),
  public.share_expiry_from_now(integer),
  public.my_default_share_expiry(),
  public.set_default_share_expiry(integer),
  public.create_share_link(uuid[], integer, boolean),
  public.set_share_link_expiry(uuid, integer),
  public.revoke_share_link(uuid)
from public, anon, authenticated;
grant execute on function
  public.my_default_share_expiry(),
  public.set_default_share_expiry(integer),
  public.create_share_link(uuid[], integer, boolean),
  public.set_share_link_expiry(uuid, integer),
  public.revoke_share_link(uuid)
to authenticated;
