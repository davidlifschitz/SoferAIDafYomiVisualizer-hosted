"use client";

import { useActionState } from "react";

import {
  signInWithEmail,
  signInWithGoogle,
  type LoginActionState,
} from "@/app/login/actions";

const initialState: LoginActionState = {};

type LoginFormProps = {
  nextPath: string;
  errorMessage?: string;
};

export function LoginForm({ nextPath, errorMessage }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    signInWithEmail,
    initialState,
  );

  return (
    <div className="login-panel">
      <header className="login-heading">
        <p className="eyebrow">Sign in</p>
        <h1>Access your workspace</h1>
        <p>Use a magic link or continue with Google.</p>
      </header>

      {errorMessage ? (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {state.error ? (
        <p className="form-message form-message-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="form-message form-message-success" role="status">
          Check your email for a sign-in link.
        </p>
      ) : null}

      <form className="login-form" action={formAction}>
        <input type="hidden" name="next" value={nextPath} />
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="field-input"
        />
        <button type="submit" className="button-primary" disabled={isPending}>
          {isPending ? "Sending link..." : "Send magic link"}
        </button>
      </form>

      <div className="login-divider" aria-hidden="true">
        <span>or</span>
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={nextPath} />
        <button type="submit" className="button-secondary">
          Continue with Google
        </button>
      </form>
    </div>
  );
}