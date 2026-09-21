import { createApp } from "./app.js";
import { config } from "./config.js";

createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  if (!config.realtimeUrl) console.warn("REALTIME_URL not set: live notifications are disabled");
  if (!config.s3) console.warn("S3_BUCKET not set: file uploads are disabled");
});
