import { supabase } from "./supabase-client.js";

const who = document.getElementById("who");

document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("index.html");
});

const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  window.location.replace("index.html");
} else {
  // RLS lets a user read only their own profile (plus classmates').
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  // textContent, not innerHTML: full_name is user-supplied.
  who.textContent = error
    ? `Signed in, but no profile found: ${error.message}`
    : `Signed in as ${profile.full_name} (${profile.role})`;
}
