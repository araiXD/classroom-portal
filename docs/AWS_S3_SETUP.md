# AWS S3 setup for file uploads

A private bucket, reached only through short-lived presigned URLs that the Express API hands
out after checking who's asking. The API uses one IAM user that can do exactly two things to
objects in this one bucket: `PutObject` and `GetObject`.

Everything below is in the AWS console; no AWS CLI needed. **Never paste AWS keys into a chat,
an issue, a commit, or a shell command line.** They go into `api/.env` only, using an editor.

## 1. Create the bucket

S3 → **Create bucket**.

- **Bucket name:** globally unique, lowercase, e.g. `classroom-portal-uploads-<some random letters>`.
- **Region:** pick one near you (e.g. `us-west-2`). Remember it, it becomes `AWS_REGION`.
- **Object Ownership:** ACLs disabled ("Bucket owner enforced"), the default.
- **Block Public Access:** leave **Block *all* public access** ticked (all four boxes). This is the
  whole point: the bucket is never public, files are only reachable through signed URLs.
- **Bucket Versioning:** Disable (the default). Versioning would keep every replaced file forever.
- **Default encryption:** SSE-S3, the default.

Create it.

## 2. CORS (so the browser may upload)

Bucket → **Permissions** → **Cross-origin resource sharing (CORS)** → Edit, paste:

```json
[
  {
    "AllowedOrigins": ["http://localhost:8000"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

Uploads are a browser `POST` straight to S3. Downloads are plain navigation to a signed URL, so
they need no CORS rule. When you deploy (Stage 7), add the Vercel origin to `AllowedOrigins`.

## 3. A least-privilege IAM user

**IAM → Policies → Create policy → JSON**, replacing `YOUR-BUCKET-NAME`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ClassroomPortalObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

Name it `classroom-portal-s3-objects`. It deliberately has no `ListBucket`, `DeleteObject`, or access
to any other bucket. (One side effect: asking S3 for a key that doesn't exist answers "403" instead
of "404".)

**IAM → Users → Create user**: name `classroom-portal-api`, *don't* enable console access, then
**Attach policies directly** → tick `classroom-portal-s3-objects`.

Open the user → **Security credentials** → **Create access key** → use case **Application running
outside AWS**. **Leave that page open**, since the secret is shown only once, and do step 4 now.

## 4. Put the keys in `api/.env` (CachyOS / fish)

In a terminal:

```fish
cd ~/Documents/Projects/classroom-portal/api
$EDITOR .env        # or: nano .env / micro .env / nvim .env
```

Add these four lines (no quotes, no spaces around `=`), copying the values from the AWS page and
your bucket:

```
S3_BUCKET=your-bucket-name
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=AKIA................
AWS_SECRET_ACCESS_KEY=........................................
```

Save, then lock the file down and confirm git ignores it and the values are present, without
printing them:

```fish
chmod 600 .env
git check-ignore -v .env                        # should print the .gitignore rule that matches
grep -c '^AWS_SECRET_ACCESS_KEY=.' .env         # should print 1
grep -c '^AWS_ACCESS_KEY_ID=AKIA' .env          # should print 1
```

Then close the AWS tab. If you ever type a key into the terminal by accident, remove it from fish's
history: `history delete --contains AWS_SECRET` (and answer the prompt).

Don't put these values in `realtime/.env`, the frontend, or anywhere else. Only the API talks to S3.

## 5. Try it

Restart the API (`npm run dev` in `api/`). It no longer prints `S3_BUCKET not set: file uploads are
disabled`. Then, in the browser:

1. **Teacher:** open a class, pick a small PDF under **Attachment**, and post the assignment. The row
   shows **Attachment: yourfile.pdf**; click it and the download starts.
2. **Student** (private window): the same assignment shows the attachment. Submit an answer with a
   file attached; the card shows **Your file: …**. The teacher's submissions list shows **File: …**.
3. Try a file over 5 MB, or a `.exe`/`.html`: the API refuses it and nothing is uploaded.

In the AWS console the bucket now holds `attachments/…` and `submissions/…` objects, and none of them
open at their plain object URL (that's the private bucket doing its job).

## If a key leaks

IAM → Users → `classroom-portal-api` → Security credentials → set the key **Inactive** and delete it,
create a new one, and update `api/.env`. The blast radius is limited to reading and writing objects
in this one bucket.
