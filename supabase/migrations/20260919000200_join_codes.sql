-- Classroom Portal — Stage 3: join codes for student enrollment
--
-- Teachers share a class's join code; students redeem it with join_class().
-- Students still can't insert into enrollments directly (the RLS policy only
-- allows the class's teacher) — join_class() is the one sanctioned path, and it
-- can only ever enroll the caller as themselves.

-- 12 hex chars = 48 random bits from Postgres's CSPRNG-backed gen_random_uuid()
-- (the first 12 hex digits of a v4 UUID are all random; the version nibble is
-- at position 13). Not guessable; Express also rate-limits redemption attempts.
-- Existing rows each get their own code: a volatile default is evaluated per row.
alter table public.classes
  add column join_code text not null unique
  default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

create function public.join_class(code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  cid uuid;
begin
  if public.current_user_role() is distinct from 'student' then
    raise exception 'only students can join classes' using errcode = '42501';
  end if;

  select c.id into cid from public.classes c where c.join_code = upper(trim(code));
  if cid is null then
    raise exception 'invalid join code' using errcode = 'P0002';
  end if;

  insert into public.enrollments (class_id, student_id)
  values (cid, (select auth.uid()))
  on conflict (class_id, student_id) do nothing;

  return cid;
end;
$$;

revoke execute on function public.join_class(text) from public, anon;
grant execute on function public.join_class(text) to authenticated;
