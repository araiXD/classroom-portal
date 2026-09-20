-- Classroom Portal — Stage 2: create the profiles row on signup
--
-- The frontend passes full_name and role as signup metadata:
--   supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })
-- This trigger copies them into public.profiles. Doing it server-side means it
-- works whether or not email confirmation is enabled (with confirmation on,
-- signUp returns no session, so the browser couldn't insert the row itself).

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    -- least privilege: anything other than an explicit 'teacher' becomes a student
    case when new.raw_user_meta_data ->> 'role' = 'teacher'
      then 'teacher'::public.user_role
      else 'student'::public.user_role
    end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles are now only ever created by the trigger, so the client-side insert
-- policy from the initial schema is dead weight. Remove it.
drop policy "profiles: insert own" on public.profiles;
