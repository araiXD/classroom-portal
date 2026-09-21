import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config.js";
import { HttpError } from "./errors.js";
import { filenameOf, MAX_FILE_BYTES } from "./files.js";

const UPLOAD_TTL_SECONDS = 120;
const DOWNLOAD_TTL_SECONDS = 60;

let client = null;
function s3() {
  if (!config.s3) throw new HttpError(503, "File uploads are not configured");
  client ??= new S3Client({
    region: config.s3.region,
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
  });
  return client;
}

// A presigned POST (not PUT) because its signed policy is how S3 itself enforces the
// size cap: S3 rejects anything outside content-length-range, and any Content-Type
// other than the one signed here, no matter what the browser sends.
export async function presignUpload({ key, contentType }) {
  const client = s3(); // throws 503 when storage isn't configured, before config.s3 is touched
  return createPresignedPost(client, {
    Bucket: config.s3.bucket,
    Key: key,
    Expires: UPLOAD_TTL_SECONDS,
    Fields: { "Content-Type": contentType },
    Conditions: [["content-length-range", 1, MAX_FILE_BYTES]],
  });
}

// Short-lived GET URL that forces a download (never renders inline).
export function presignDownload(key) {
  const client = s3(); // throws 503 when storage isn't configured, before config.s3 is touched
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filenameOf(key)}"`, // name is [A-Za-z0-9._-]
  });
  return getSignedUrl(client, command, { expiresIn: DOWNLOAD_TTL_SECONDS });
}
