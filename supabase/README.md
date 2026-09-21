# Supabase

Schema lives in `migrations/` as plain SQL (Supabase CLI naming, so `supabase link` +
`supabase db push` will work later without changes).

## Apply

1. Create a project at https://supabase.com/dashboard.
2. SQL Editor → New query → paste `migrations/20260919000000_initial_schema.sql` → Run.
3. Copy the project URL and keys into a local `.env` (see `../.env.example`).

Run the migrations in filename order, each once. They aren't idempotent — to redo one,
drop what it creates (or reset the project) first.

- `20260919000000_initial_schema.sql` — tables, helper functions, RLS
- `20260919000100_profile_on_signup.sql` — trigger that creates the `profiles` row when a
  user signs up (reads `full_name` and `role` from signup metadata; anything other than
  `teacher` becomes `student`) and drops the now-unneeded client-side insert policy
- `20260919000200_join_codes.sql` — adds `classes.join_code` (12 random hex chars, unique)
  and `join_class(code)`, the only way for a student to enroll themselves

## Check it worked

Table Editor should list `profiles`, `classes`, `enrollments`, `assignments`,
`submissions`, each without the "RLS disabled" badge. Or in the SQL editor:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- expect rowsecurity = true for all five
```

## Access rules

| Table         | Teacher                                | Student                                   |
|---------------|----------------------------------------|-------------------------------------------|
| `profiles`    | own + students in their classes        | own + teachers of their classes           |
| `classes`     | CRUD own                               | read enrolled                             |
| `enrollments` | read/add/remove for own classes        | read own; enroll self only via `join_class()` |
| `assignments` | CRUD in own classes                    | read in enrolled classes                  |
| `submissions` | read for assignments in own classes    | read/insert/update own, enrolled classes  |

Notes:
- The service-role key bypasses RLS, so no service here uses it. The Express API acts as the
  caller (their JWT), which keeps these policies as the single source of truth.
- `profiles` has no insert/update/delete policy: rows are created only by the signup
  trigger, and a role can't be changed afterwards.
- `assignments.attachment_url` and `submissions.file_url` hold **S3 object keys**, not URLs (the column
  names predate the S3 design). The API validates their shape on write and before signing a download
  (see `api/README.md`); the database doesn't constrain them, because RLS deliberately lets you write
  your own rows, so anything reading these columns must not trust them.
- One submission per student per assignment (`unique (assignment_id, student_id)`);
  resubmitting is an update.
