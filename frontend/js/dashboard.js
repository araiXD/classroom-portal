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
  if (error) {
    who.textContent = `Signed in, but no profile found: ${error.message}`;
  } else {
    who.textContent = `Signed in as ${profile.full_name} (${profile.role})`;
    const view = await import(profile.role === "teacher" ? "./teacher.js" : "./student.js");
    await view.mount(document.getElementById("app"));
  }
}
