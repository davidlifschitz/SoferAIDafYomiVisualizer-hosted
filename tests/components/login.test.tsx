import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/login-form";
import { isProtectedPath, sanitizeNextPath } from "@/lib/auth/redirect";

vi.mock("@/app/login/actions", () => ({
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

describe("sanitizeNextPath", () => {
  it("returns the fallback for unsafe redirects", () => {
    expect(sanitizeNextPath(undefined, "/")).toBe("/");
    expect(sanitizeNextPath("https://evil.test", "/")).toBe("/");
    expect(sanitizeNextPath("//evil.test", "/")).toBe("/");
    expect(sanitizeNextPath("/\\evil", "/")).toBe("/");
  });

  it("allows safe relative redirects", () => {
    expect(sanitizeNextPath("/billing", "/")).toBe("/billing");
    expect(sanitizeNextPath("/analyses/123", "/")).toBe("/analyses/123");
  });
});

describe("isProtectedPath", () => {
  it("protects the workspace routes", () => {
    expect(isProtectedPath("/")).toBe(true);
    expect(isProtectedPath("/billing")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/analyses/123")).toBe(true);
  });

  it("leaves public routes open", () => {
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/library")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
    expect(isProtectedPath("/r/share-id")).toBe(false);
  });
});

describe("LoginForm", () => {
  it("renders magic link and Google sign-in controls", () => {
    render(<LoginForm nextPath="/billing" />);

    expect(screen.getByRole("heading", { name: /access your workspace/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send magic link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("/billing")).toHaveLength(2);
  });

  it("shows callback errors from the login page", () => {
    render(
      <LoginForm
        nextPath="/"
        errorMessage="missing_auth_code"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("missing_auth_code");
  });
});