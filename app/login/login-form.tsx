"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  initialError,
  nextPath,
}: {
  initialError?: string;
  nextPath: string;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState(initialError ?? "");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const supabase = createClient();

    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      setPending(false);
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
      setPending(false);
      return;
    }

    window.location.assign(nextPath);
  }

  async function signInWithGoogle() {
    setPending(true);
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
    if (error) {
      setMessage(error.message);
      setPending(false);
    }
  }

  return (
    <section className="login-card" aria-labelledby="login-heading">
      <div className="login-brand">
        <span className="brand-mark">D</span>
        <div>
          <strong>Daily English</strong>
          <small>A calm daily learning loop</small>
        </div>
      </div>
      <p className="eyebrow">Welcome</p>
      <h1 id="login-heading">{mode === "sign-in" ? "Continue learning" : "Create your account"}</h1>
      <p className="login-intro">Your vocabulary, review history, and progress stay private to your account.</p>

      <button className="google-button" type="button" onClick={signInWithGoogle} disabled={pending}>
        Continue with Google
      </button>
      <div className="login-divider"><span>or use email</span></div>

      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
          />
        </label>
        {message ? <p className="form-message" role="status">{message}</p> : null}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        className="mode-button"
        type="button"
        onClick={() => {
          setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
          setMessage("");
        }}
      >
        {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
