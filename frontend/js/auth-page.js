import { supabase } from "./supabase-client.js";

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const message = document.getElementById("message");

function show(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "error" : "";
}

function showForm(id) {
  loginForm.hidden = id !== "login-form";
  signupForm.hidden = id !== "signup-form";
  show("");
}

document.querySelectorAll("[data-show]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showForm(link.dataset.show);
  });
});

// Already signed in? Skip the form.
const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.replace("dashboard.html");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(loginForm);
  show("Logging in…");

  const { error } = await supabase.auth.signInWithPassword({
    email: form.get("email"),
    password: form.get("password"),
  });

  if (error) return show(error.message, true);
  window.location.replace("dashboard.html");
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(signupForm);
  show("Creating account…");

  // full_name and role travel as user metadata; a database trigger turns them
  // into the profiles row (see supabase/migrations/*_profile_on_signup.sql).
  const { data, error } = await supabase.auth.signUp({
    email: form.get("email"),
    password: form.get("password"),
    options: {
      data: { full_name: form.get("full_name"), role: form.get("role") },
    },
  });

  if (error) return show(error.message, true);

  // With email confirmation on, there's no session until the link is clicked.
  if (!data.session) {
    return show("Check your email to confirm your account, then log in.");
  }
  window.location.replace("dashboard.html");
});
