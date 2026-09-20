import { supabase } from "./supabase-client.js";
import { REALTIME_WS_URL } from "./config.js";

const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

// Keeps a WebSocket to the realtime service open and authenticated as the signed-in
// user, reconnecting with backoff. The first message on each connection is the
// Supabase access token (never put in the URL, where it would end up in logs).
//
//   onStatus("connecting" | "live" | "offline")
//   onMessage(message)   every pushed message except the ready/error handshake
//
// Returns { close() }.
export function connectLive({ onMessage, onStatus }) {
  let socket = null;
  let closed = false;
  let timer = null;
  let delay = MIN_DELAY_MS;

  function retry() {
    if (closed) return;
    timer = setTimeout(open, delay);
    delay = Math.min(delay * 2, MAX_DELAY_MS);
  }

  async function open() {
    if (closed) return;
    onStatus("connecting");

    // Fresh token each attempt: supabase-js refreshes it when it has expired.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return onStatus("offline");

    let ws;
    try {
      ws = new WebSocket(REALTIME_WS_URL);
    } catch {
      onStatus("offline");
      return retry();
    }
    socket = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "auth", token: session.access_token }));
    });
    ws.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "ready") {
        delay = MIN_DELAY_MS;
        onStatus("live");
      } else if (message.type === "error") {
        console.warn("Realtime service:", message.message);
      } else {
        onMessage(message);
      }
    });
    ws.addEventListener("close", () => {
      if (socket !== ws) return;
      onStatus("offline");
      retry();
    });
  }

  open();

  return {
    close() {
      closed = true;
      clearTimeout(timer);
      socket?.close();
    },
  };
}
