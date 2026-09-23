// Public values: the anon key is designed to ship to the browser (RLS protects the data).
// Never put the service-role key here.
export const SUPABASE_URL = "https://ojwtdvlhdskxkbgncadh.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qd3RkdmxoZHNreGtiZ25jYWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NTI3NjEsImV4cCI6MjEwNTQyODc2MX0.BHswqy11M4e7woyeIHl98x1UTBFwFOgg1of3KWuP-O0";
// The API and realtime service switch by hostname: localhost keeps talking to the local
// dev servers; anything else (the deployed site) talks to the deployed Render services.
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

export const API_URL = isLocal ? "http://localhost:3000" : "https://classroom-portal-api.onrender.com";
// wss://, not ws://: a page served over https can't open a plain ws:// connection.
export const REALTIME_WS_URL = isLocal
  ? "ws://localhost:8001/ws"
  : "wss://classroom-portal-realtime.onrender.com/ws";
