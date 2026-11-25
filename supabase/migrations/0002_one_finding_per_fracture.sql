-- A report lists each fracture once: one finding per bone, side, and part (#111).
-- The reader already makes these one finding (S2.1), so a second copy could only
-- come from a patient's edit, and the web app refuses it too. Findings with no bone
-- chosen, such as those outside coverage, aren't compared.
--
-- If a project already holds a repeated finding, this stops with the repeated key
-- and changes nothing. Nothing is deleted for you. Find them with:
--   select report_id, bone, side, public.sorted_parts(part), count(*)
--   from public.findings where bone <> ''
--   group by 1, 2, 3, 4 having count(*) > 1;

-- Parts in a fixed order, so {shaft,distal} and {distal,shaft} are the same part.
create function public.sorted_parts(parts text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(p order by p), '{}') from unnest(parts) as p;
$$;

create unique index findings_one_per_fracture
  on public.findings (report_id, bone, side, public.sorted_parts(part))
  where bone <> '';
