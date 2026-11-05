-- The cross-account test from Plan Milestone 4, on the access rules themselves.
-- Every check raises an error if it fails. Run with supabase/tests/run.sh.
\set ON_ERROR_STOP on
create schema testkit;

insert into auth.users values
  ('aaaaaaaa-0000-0000-0000-000000000001', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', now()),
  ('cccccccc-0000-0000-0000-000000000003', null);

create function testkit.act_as(who text) returns void language plpgsql as $$
begin
  perform set_config('test.uid', who, false);
  perform set_config('test.jwt',
    json_build_object('iat', extract(epoch from now())::bigint)::text, false);
  execute 'set role authenticated';
end $$;

create function testkit.must_fail(statement text, label text) returns void
language plpgsql as $$
begin
  execute statement;
  raise exception 'NOT REFUSED: %', label using errcode = 'P0001';
exception
  when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'refused: %', label;
end $$;

create function testkit.must_affect(statement text, expected int, label text)
returns void language plpgsql as $$
declare affected int;
begin
  execute statement;
  get diagnostics affected = row_count;
  if affected <> expected then
    raise exception 'WRONG: % affected % rows, expected %', label, affected, expected;
  end if;
  raise notice 'ok: %', label;
end $$;

grant usage on schema testkit to anon, authenticated;
grant execute on all functions in schema testkit to anon, authenticated;

-- A adds a report, a finding, and a file.
select testkit.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.reports (id, source, raw_text, exam_date, exam_date_source, file_path)
values ('11111111-0000-0000-0000-000000000001', 'pdf', 'fictional report', '2026-09-14',
        'report', 'aaaaaaaa-0000-0000-0000-000000000001/11111111-0000-0000-0000-000000000001.pdf');
insert into public.findings (id, report_id, bone, side, certainty, status) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'radius', 'left', 'certain', 'placed');
insert into storage.objects (bucket_id, name) values
  ('reports', 'aaaaaaaa-0000-0000-0000-000000000001/11111111-0000-0000-0000-000000000001.pdf');

-- A sees and changes what's allowed.
select testkit.must_affect($$select * from public.reports$$, 1, 'A reads own report');
select testkit.must_affect($$select * from public.findings$$, 1, 'A reads own finding');
select testkit.must_affect($$select * from storage.objects$$, 1, 'A reads own file');
select testkit.must_affect(
  $$update public.reports set exam_date = '2026-09-15', exam_date_source = 'patient'$$,
  1, 'A changes the exam date');
select testkit.must_affect(
  $$update public.findings set side = 'right', entered_by_patient = true$$,
  1, 'A corrects a finding');

-- The report and the wording it came from are never edited (NFR4).
select testkit.must_fail($$update public.reports set raw_text = 'edited'$$, 'A edits report text');
select testkit.must_fail($$update public.reports set user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'A gives a report away');
select testkit.must_fail($$update public.findings set wording = '[]'$$, 'A edits report wording');
select testkit.must_fail(
  $$insert into public.reports (source, raw_text, exam_date, exam_date_source)
    values ('pasted', 'x', current_date + 30, 'patient')$$,
  'exam date in the future');

-- B can't read, change, or delete any of it, by any route.
select testkit.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select testkit.must_affect($$select * from public.reports$$, 0, 'B sees none of A''s reports');
select testkit.must_affect($$select * from public.findings$$, 0, 'B sees none of A''s findings');
select testkit.must_affect($$select * from storage.objects$$, 0, 'B sees none of A''s files');
select testkit.must_affect($$update public.reports set exam_date = '2026-01-01'$$, 0, 'B can''t change A''s report');
select testkit.must_affect($$update public.findings set side = 'left'$$, 0, 'B can''t change A''s finding');
select testkit.must_affect($$delete from public.findings$$, 0, 'B can''t delete A''s finding');
select testkit.must_affect($$delete from public.reports$$, 0, 'B can''t delete A''s report');
select testkit.must_affect($$delete from storage.objects$$, 0, 'B can''t delete A''s file');
select testkit.must_fail(
  $$insert into public.reports (user_id, source, raw_text, exam_date, exam_date_source)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'pasted', 'x', '2026-01-01', 'patient')$$,
  'B adds a report to A''s account');
select testkit.must_fail(
  $$insert into public.findings (report_id, certainty, status)
    values ('11111111-0000-0000-0000-000000000001', 'certain', 'placed')$$,
  'B adds a finding to A''s report');
select testkit.must_fail(
  $$insert into storage.objects (bucket_id, name)
    values ('reports', 'aaaaaaaa-0000-0000-0000-000000000001/planted.pdf')$$,
  'B plants a file in A''s folder');

-- An account with an unconfirmed email can't store reports (S6.1).
select testkit.act_as('cccccccc-0000-0000-0000-000000000003');
select testkit.must_fail(
  $$insert into public.reports (source, raw_text, exam_date, exam_date_source)
    values ('pasted', 'x', '2026-01-01', 'patient')$$,
  'unconfirmed account adds a report');
select testkit.must_fail(
  $$insert into storage.objects (bucket_id, name)
    values ('reports', 'cccccccc-0000-0000-0000-000000000003/x.pdf')$$,
  'unconfirmed account adds a file');

-- Nobody signed in can reach anything.
reset role;
set role anon;
select testkit.must_fail($$select * from public.reports$$, 'anon reads reports');
select testkit.must_fail($$select public.delete_my_account()$$, 'anon deletes an account');
reset role;

-- Deleting an account needs a fresh sign-in.
select testkit.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select set_config('test.jwt', json_build_object('iat', extract(epoch from now())::bigint - 3600)::text, false);
do $$
begin
  perform public.delete_my_account();
  raise exception 'NOT REFUSED: delete with an old sign-in' using errcode = 'P0001';
exception when raise_exception then
  if sqlerrm like 'NOT REFUSED%' then raise; end if;
  raise notice 'refused: delete with an old sign-in';
end $$;

-- Deleting a report deletes its findings (S1.3).
select testkit.act_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.reports (id, source, raw_text, exam_date, exam_date_source) values
  ('33333333-0000-0000-0000-000000000003', 'pasted', 'x', '2026-01-01', 'patient');
insert into public.findings (report_id, certainty, status) values
  ('33333333-0000-0000-0000-000000000003', 'certain', 'placed');
select testkit.must_affect($$delete from public.reports$$, 1, 'B deletes own report');
select testkit.must_affect($$select * from public.findings$$, 0, 'its findings are gone');

-- Deleting an account deletes everything in it (S6.3, NFR10).
select testkit.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select public.delete_my_account();
reset role;
select testkit.must_affect($$select * from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 0, 'A''s account is gone');
select testkit.must_affect($$select * from public.reports where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 0, 'A''s reports are gone');
select testkit.must_affect($$select * from public.findings where report_id = '11111111-0000-0000-0000-000000000001'$$, 0, 'A''s findings are gone');

-- The same email address can sign up again (S6.3). A new id means an empty account.
insert into auth.users values ('aaaaaaaa-0000-0000-0000-00000000000a', now());
select testkit.act_as('aaaaaaaa-0000-0000-0000-00000000000a');
select testkit.must_affect($$select * from public.reports$$, 0, 'new account starts empty');
reset role;

\echo ALL ACCESS CHECKS PASSED
