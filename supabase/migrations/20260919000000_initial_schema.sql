-- Classroom Portal — Stage 1: schema + Row Level Security
--
-- Tables: profiles, classes, enrollments, assignments, submissions
-- Access model:
--   * teachers read/write only their own classes (and the assignments in them)
--   * students read only classes they are enrolled in, and write only their own submissions
--   * enrollments are managed by the class's teacher

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('teacher', 'student');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        public.user_role not null,
  created_at  timestamptz not null default now()
);

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (class_id, student_id)
);

create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes (id) on delete cascade,
  title           text not null,
  description     text,
  due_date        timestamptz,
  attachment_url  text,
  created_at      timestamptz not null default now()
);

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  content       text,
  file_url      text,
  submitted_at  timestamptz not null default now(),
  -- a submission needs text, a file, or both
  check (content is not null or file_url is not null),
  -- one submission per student per assignment (updates replace it)
  unique (assignment_id, student_id)
);

-- Postgres doesn't index the referencing side of a foreign key automatically.
-- (enrollments and submissions are already covered by their unique constraints
-- for the leading column; student_id lookups need their own index.)
create index classes_teacher_id_idx      on public.classes (teacher_id);
create index enrollments_student_id_idx  on public.enrollments (student_id);
create index assignments_class_id_idx    on public.assignments (class_id);
create index submissions_student_id_idx  on public.submissions (student_id);

-- ---------------------------------------------------------------------------
-- Helper functions for RLS
--
-- SECURITY DEFINER so they can read across tables without re-entering RLS.
-- That is what prevents the classes <-> enrollments policies from recursing
-- into each other. search_path is pinned and every name is schema-qualified.
-- ---------------------------------------------------------------------------

create function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create function public.is_student(profile_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.role = 'student'
  );
$$;

create function public.is_class_teacher(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.classes c
    where c.id = cid and c.teacher_id = (select auth.uid())
  );
$$;

create function public.is_enrolled(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.class_id = cid and e.student_id = (select auth.uid())
  );
$$;

create function public.is_assignment_teacher(aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    join public.classes c on c.id = a.class_id
    where a.id = aid and c.teacher_id = (select auth.uid())
  );
$$;

create function public.is_assignment_student(aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    join public.enrollments e on e.class_id = a.class_id
    where a.id = aid and e.student_id = (select auth.uid())
  );
$$;

-- True when the given profile is the teacher of a class the caller is enrolled
-- in, or a student enrolled in a class the caller teaches.
create function public.shares_class_with(profile_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.enrollments e on e.class_id = c.id
    where (c.teacher_id = (select auth.uid()) and e.student_id = profile_id)
       or (e.student_id = (select auth.uid()) and c.teacher_id = profile_id)
  );
$$;

-- Supabase exposes public-schema functions as RPC endpoints; only signed-in
-- users need these.
revoke execute on function
  public.current_user_role(),
  public.is_student(uuid),
  public.is_class_teacher(uuid),
  public.is_enrolled(uuid),
  public.is_assignment_teacher(uuid),
  public.is_assignment_student(uuid),
  public.shares_class_with(uuid)
from public, anon;

grant execute on function
  public.current_user_role(),
  public.is_student(uuid),
  public.is_class_teacher(uuid),
  public.is_enrolled(uuid),
  public.is_assignment_teacher(uuid),
  public.is_assignment_student(uuid),
  public.shares_class_with(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- RLS is default-deny: an operation with no matching policy is rejected.
-- Every policy below is scoped `to authenticated`, so anon gets nothing.
-- The Express service's service-role key bypasses RLS entirely — enforce
-- ownership in the API middleware when using it.
-- ---------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.classes     enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- profiles ------------------------------------------------------------------
-- Read your own profile, plus profiles of people you share a class with
-- (teachers need student names; students need their teacher's name).
-- No update/delete policies yet: a role can't be changed after signup.

create policy "profiles: read own or classmates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_class_with(id));

create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

-- classes -------------------------------------------------------------------

create policy "classes: read own or enrolled"
  on public.classes for select to authenticated
  using (teacher_id = (select auth.uid()) or public.is_enrolled(id));

create policy "classes: teachers create own"
  on public.classes for insert to authenticated
  with check (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
  );

create policy "classes: teachers update own"
  on public.classes for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

create policy "classes: teachers delete own"
  on public.classes for delete to authenticated
  using (teacher_id = (select auth.uid()));

-- enrollments ---------------------------------------------------------------
-- Students see their own enrollments; the class's teacher sees and manages all
-- of them.

create policy "enrollments: read own or as class teacher"
  on public.enrollments for select to authenticated
  using (student_id = (select auth.uid()) or public.is_class_teacher(class_id));

create policy "enrollments: class teacher enrolls students"
  on public.enrollments for insert to authenticated
  with check (public.is_class_teacher(class_id) and public.is_student(student_id));

create policy "enrollments: class teacher removes students"
  on public.enrollments for delete to authenticated
  using (public.is_class_teacher(class_id));

-- assignments ---------------------------------------------------------------

create policy "assignments: read as class teacher or enrolled student"
  on public.assignments for select to authenticated
  using (public.is_class_teacher(class_id) or public.is_enrolled(class_id));

create policy "assignments: class teacher creates"
  on public.assignments for insert to authenticated
  with check (public.is_class_teacher(class_id));

create policy "assignments: class teacher updates"
  on public.assignments for update to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

create policy "assignments: class teacher deletes"
  on public.assignments for delete to authenticated
  using (public.is_class_teacher(class_id));

-- submissions ---------------------------------------------------------------
-- Students write only their own, and only for assignments in classes they're
-- enrolled in. The assignment's teacher can read all submissions for it.

create policy "submissions: read own or as assignment teacher"
  on public.submissions for select to authenticated
  using (
    student_id = (select auth.uid())
    or public.is_assignment_teacher(assignment_id)
  );

create policy "submissions: students submit own"
  on public.submissions for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and public.is_assignment_student(assignment_id)
  );

create policy "submissions: students update own"
  on public.submissions for update to authenticated
  using (student_id = (select auth.uid()))
  with check (
    student_id = (select auth.uid())
    and public.is_assignment_student(assignment_id)
  );
