-- Share links (S10.1): only the owner can make, read, change, or turn off a link,
-- and only to their own reports. Runs after access.sql, which sets up testkit.
\set ON_ERROR_STOP on

reset role;
insert into auth.users values
  ('dddddddd-0000-0000-0000-000000000004', now()),
  ('eeeeeeee-0000-0000-0000-000000000005', now());

create function testkit.must_be(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'WRONG: % is %, expected %', label, actual, expected;
  end if;
  raise notice 'ok: %', label;
end $$;
grant execute on function testkit.must_be(anyelement, anyelement, text) to authenticated;

-- Passes when the statement is refused or changes no rows, so it tests row-level
-- security even if a write grant is added later.
create function testkit.must_change_nothing(statement text, label text)
returns void language plpgsql as $$
declare affected int;
begin
  execute statement;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'NOT REFUSED: % changed % rows', label, affected;
  end if;
  raise notice 'changed nothing: %', label;
exception when insufficient_privilege then
  raise notice 'refused: %', label;
end $$;
grant execute on function testkit.must_change_nothing(text, text) to authenticated;

-- D has two reports, E has one.
select testkit.act_as('dddddddd-0000-0000-0000-000000000004');
insert into public.reports (id, source, raw_text, exam_date, exam_date_source) values
  ('44444444-0000-0000-0000-000000000001', 'pasted', 'fictional', '2026-09-01', 'report'),
  ('44444444-0000-0000-0000-000000000002', 'pasted', 'fictional', '2026-10-01', 'report');
select testkit.act_as('eeeeeeee-0000-0000-0000-000000000005');
insert into public.reports (id, source, raw_text, exam_date, exam_date_source) values
  ('55555555-0000-0000-0000-000000000001', 'pasted', 'fictional', '2026-09-01', 'report');

-- D makes a link to both reports, with the default expiry.
select testkit.act_as('dddddddd-0000-0000-0000-000000000004');
select set_config('test.link', id::text, false)
     , set_config('test.token', token, false)
from public.create_share_link(
  array['44444444-0000-0000-0000-000000000001',
        '44444444-0000-0000-0000-000000000002']::uuid[],
  null, true);
select testkit.must_be(length(current_setting('test.token')), 43, 'token is 32 bytes of base64url');
select testkit.must_be(current_setting('test.token') ~ '^[A-Za-z0-9_-]+$', true, 'token is url safe');
select testkit.must_affect($$select * from public.share_links$$, 1, 'D reads own link');
select testkit.must_affect($$select * from public.share_link_reports$$, 2, 'D reads what it covers');
select testkit.must_be(
  (select round(extract(epoch from expires_at - created_at) / 86400) from public.share_links),
  30::numeric, 'default expiry is 30 days');

reset role;
select testkit.must_be(
  (select token_hash from public.share_links where id = current_setting('test.link')::uuid),
  encode(sha256(convert_to(current_setting('test.token'), 'UTF8')), 'hex'),
  'only the token''s SHA-256 is stored');
select testkit.must_be(
  (select count(*) from public.share_links where token_hash = current_setting('test.token')),
  0::bigint, 'the raw token is not stored');
select testkit.must_be(public.share_link_is_active(current_setting('test.link')::uuid), true, 'new link is active');

-- D changes the default, and new links use it. Null means never.
select testkit.act_as('dddddddd-0000-0000-0000-000000000004');
select public.set_default_share_expiry(7);
select testkit.must_be(public.my_default_share_expiry(), 7, 'default is now 7');
select testkit.must_be(
  (select round(extract(epoch from expires_at - now()) / 86400)
   from public.create_share_link(array['44444444-0000-0000-0000-000000000001']::uuid[], null, true)),
  7::numeric, 'new link uses the changed default');
select public.set_default_share_expiry(null);
select testkit.must_be(public.my_default_share_expiry(), null::integer, 'default can be never');
select testkit.must_be(
  (select expires_at from public.create_share_link(array['44444444-0000-0000-0000-000000000001']::uuid[], null, true)),
  null::timestamptz, 'never expires when the default is never');
select testkit.must_be(
  (select expires_at from public.create_share_link(array['44444444-0000-0000-0000-000000000001']::uuid[], null)),
  null::timestamptz, 'an explicit never wins over the default');
select testkit.must_fail($$select public.set_default_share_expiry(3)$$, 'default of 3 days');
select testkit.must_fail(
  $$select * from public.create_share_link(array['44444444-0000-0000-0000-000000000001']::uuid[], 2)$$,
  'link that expires in 2 days');
select testkit.must_fail($$select * from public.create_share_link(array[]::uuid[], 7)$$, 'link with no reports');

-- D changes the expiry, then turns the link off. It stays off.
select testkit.must_be(
  (select round(extract(epoch from expires_at - now()) / 86400)
   from public.set_share_link_expiry(current_setting('test.link')::uuid, 90)),
  90::numeric, 'D changes the expiry');
select testkit.must_be(
  (select expires_at from public.set_share_link_expiry(current_setting('test.link')::uuid, null)),
  null::timestamptz, 'D makes it never expire');
select public.revoke_share_link(current_setting('test.link')::uuid);
select testkit.must_affect(
  format($$select * from public.share_links where id = %L and revoked_at is not null$$,
         current_setting('test.link')),
  1, 'D turns the link off');
select testkit.must_fail(
  format($$select * from public.set_share_link_expiry(%L, 30)$$, current_setting('test.link')),
  'D turns an off link back on by changing its expiry');
reset role;
select testkit.must_be(public.share_link_is_active(current_setting('test.link')::uuid), false, 'turned-off link is unavailable');

-- Patients can't write the tables directly, so every write goes through the checks.
select testkit.act_as('dddddddd-0000-0000-0000-000000000004');
select testkit.must_fail(
  $$insert into public.share_links (owner_user_id, token_hash)
    values ('dddddddd-0000-0000-0000-000000000004', 'weak')$$,
  'D inserts a link directly');
select testkit.must_fail(
  format($$insert into public.share_link_reports values (%L, '55555555-0000-0000-0000-000000000001')$$,
         current_setting('test.link')),
  'D adds a report to a link directly');
select testkit.must_fail($$update public.share_links set revoked_at = null$$, 'D turns a link back on directly');
select testkit.must_fail($$delete from public.share_links$$, 'D deletes a link directly');
select testkit.must_fail(
  $$update public.user_settings set default_share_expiry_days = 1$$,
  'D writes settings directly');

-- D can't share E's report, even alongside one of D's own.
select testkit.must_fail(
  $$select * from public.create_share_link(array['55555555-0000-0000-0000-000000000001']::uuid[], 7)$$,
  'D shares E''s report');
select testkit.must_fail(
  $$select * from public.create_share_link(
      array['44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001']::uuid[], 7)$$,
  'D slips E''s report in with D''s own');
select testkit.must_fail(
  $$select * from public.create_share_link(array['99999999-0000-0000-0000-000000000009']::uuid[], 7)$$,
  'D shares a report that doesn''t exist');

-- E can't see, change, or turn off D's links, or read D's settings.
select testkit.act_as('eeeeeeee-0000-0000-0000-000000000005');
select testkit.must_affect($$select * from public.share_links$$, 0, 'E sees none of D''s links');
select testkit.must_affect($$select * from public.share_link_reports$$, 0, 'E sees none of what D''s links cover');
select testkit.must_affect($$select * from public.user_settings$$, 0, 'E sees none of D''s settings');
select testkit.must_be(public.my_default_share_expiry(), 30, 'E''s default is still 30');
select testkit.must_fail(
  $$insert into public.user_settings values ('bbbbbbbb-0000-0000-0000-000000000002', 1)$$,
  'E makes a settings row for B');
select testkit.must_change_nothing(
  $$update public.user_settings set default_share_expiry_days = 1
    where user_id = 'dddddddd-0000-0000-0000-000000000004'$$,
  'E changes D''s settings row');
select testkit.must_change_nothing(
  $$update public.user_settings set user_id = 'eeeeeeee-0000-0000-0000-000000000005'
    where user_id = 'dddddddd-0000-0000-0000-000000000004'$$,
  'E takes over D''s settings row');
select public.set_default_share_expiry(14);
select testkit.must_change_nothing(
  $$update public.user_settings set user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'E hands its settings row to B');
reset role;
select testkit.must_be(
  (select default_share_expiry_days from public.user_settings
   where user_id = 'dddddddd-0000-0000-0000-000000000004'),
  null::integer, 'E saving a default leaves D''s untouched');
select testkit.act_as('eeeeeeee-0000-0000-0000-000000000005');
reset role;
select set_config('test.active_link', (
  select id::text from public.share_links
  where owner_user_id = 'dddddddd-0000-0000-0000-000000000004' and revoked_at is null
  limit 1), false);
select testkit.act_as('eeeeeeee-0000-0000-0000-000000000005');
select testkit.must_fail(
  format($$select * from public.set_share_link_expiry(%L, 1)$$, current_setting('test.active_link')),
  'E changes the expiry of D''s link');
select testkit.must_fail(
  format($$select public.revoke_share_link(%L)$$, current_setting('test.active_link')),
  'E turns off D''s link');
reset role;
select testkit.must_be(public.share_link_is_active(current_setting('test.active_link')::uuid), true, 'D''s link is untouched');

-- A link past its expiry is unavailable.
update public.share_links set expires_at = now() - interval '1 second'
where id = current_setting('test.active_link')::uuid;
select testkit.must_be(public.share_link_is_active(current_setting('test.active_link')::uuid), false, 'expired link is unavailable');

-- A deleted report drops out of its links, and a link with no reports left is unavailable.
update public.share_links set expires_at = null
where id = current_setting('test.active_link')::uuid;
select testkit.act_as('dddddddd-0000-0000-0000-000000000004');
select testkit.must_affect($$delete from public.reports$$, 2, 'D deletes both reports');
select testkit.must_affect($$select * from public.share_link_reports$$, 0, 'they drop out of every link');
reset role;
select testkit.must_be(public.share_link_is_active(current_setting('test.active_link')::uuid), false, 'link with no reports is unavailable');

-- Nobody signed in can use any of it.
set role anon;
select testkit.must_fail($$select * from public.share_links$$, 'anon reads links');
select testkit.must_fail($$select * from public.share_link_reports$$, 'anon reads what links cover');
select testkit.must_fail($$select * from public.user_settings$$, 'anon reads settings');
select testkit.must_fail($$select * from public.create_share_link(array['55555555-0000-0000-0000-000000000001']::uuid[], 7)$$, 'anon makes a link');
select testkit.must_fail(format($$select * from public.set_share_link_expiry(%L, 7)$$, current_setting('test.active_link')), 'anon changes an expiry');
select testkit.must_fail(format($$select public.revoke_share_link(%L)$$, current_setting('test.active_link')), 'anon turns off a link');
select testkit.must_fail($$select public.set_default_share_expiry(7)$$, 'anon sets a default');
select testkit.must_fail($$select public.my_default_share_expiry()$$, 'anon reads a default');
select testkit.must_fail($$select public.share_link_is_active(gen_random_uuid())$$, 'anon checks a link');
select testkit.must_fail($$select public.share_token_hash('x')$$, 'anon hashes a token');
reset role;

-- A signed-in role with no account id is refused by every function itself.
select testkit.act_as('');
select testkit.must_fail($$select * from public.create_share_link(array['55555555-0000-0000-0000-000000000001']::uuid[], 7)$$, 'no account id makes a link');
select testkit.must_fail(format($$select * from public.set_share_link_expiry(%L, 7)$$, current_setting('test.active_link')), 'no account id changes an expiry');
select testkit.must_fail(format($$select public.revoke_share_link(%L)$$, current_setting('test.active_link')), 'no account id turns off a link');
select testkit.must_fail($$select public.set_default_share_expiry(7)$$, 'no account id sets a default');
select testkit.must_fail($$select public.my_default_share_expiry()$$, 'no account id reads a default');
select testkit.must_fail($$select public.share_link_is_active(gen_random_uuid())$$, 'patient checks any link''s state');
select testkit.must_fail($$select public.share_token_hash('x')$$, 'patient calls the hash helper');
reset role;

-- EXECUTE is as narrow as the contract: nothing for PUBLIC or anon, and
-- authenticated only on the patient functions.
do $$
declare
  fn record;
  patient_rpcs text[] := array[
    'create_share_link', 'set_share_link_expiry', 'revoke_share_link',
    'set_default_share_expiry', 'my_default_share_expiry'];
begin
  for fn in
    select p.oid, p.proname, p.proacl from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('share_token_hash', 'share_link_is_active', 'share_expiry_from_now',
                        'my_default_share_expiry', 'set_default_share_expiry',
                        'create_share_link', 'set_share_link_expiry', 'revoke_share_link')
  loop
    if fn.proacl is null or exists (
      select 1 from aclexplode(fn.proacl) as acl where acl.grantee = 0
    ) then
      raise exception 'WRONG: PUBLIC can execute %', fn.proname;
    end if;
    if has_function_privilege('anon', fn.oid, 'execute') then
      raise exception 'WRONG: anon can execute %', fn.proname;
    end if;
    if has_function_privilege('authenticated', fn.oid, 'execute')
       <> (fn.proname = any (patient_rpcs)) then
      raise exception 'WRONG: authenticated EXECUTE on % is not as the contract says', fn.proname;
    end if;
  end loop;
  raise notice 'ok: EXECUTE grants are narrow';
end $$;

-- Every function that runs with its owner's rights pins its search path.
do $$
declare bad text;
begin
  select string_agg(p.proname, ', ') into bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not coalesce('search_path=""' = any (p.proconfig), false);
  if bad is not null then
    raise exception 'WRONG: security definer without search_path = '''': %', bad;
  end if;
  raise notice 'ok: security definer functions pin search_path';
end $$;

-- Deleting an account deletes its links and settings.
select testkit.act_as('dddddddd-0000-0000-0000-000000000004');
select public.delete_my_account();
reset role;
select testkit.must_affect($$select * from public.share_links where owner_user_id = 'dddddddd-0000-0000-0000-000000000004'$$, 0, 'D''s links are gone');
select testkit.must_affect($$select * from public.user_settings where user_id = 'dddddddd-0000-0000-0000-000000000004'$$, 0, 'D''s settings are gone');

\echo ALL SHARING CHECKS PASSED
