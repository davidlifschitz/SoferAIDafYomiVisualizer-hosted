"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type SubmitResponse = {
  analysisId: string;
  status: string;
  reused?: boolean;
};

type SubmitErrorResponse = {
  error?: string;
  code?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `submit-${Date.now()}`;
}

export function AnalysisForm() {
  const router = useRouter();
  const turnstileContainerId = useId().replace(/:/g, "");
  const widgetIdRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const turnstileEnabled = Boolean(turnstileSiteKey);

  const [lectureUrl, setLectureUrl] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!turnstileEnabled) {
      return;
    }

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !window.turnstile || widgetIdRef.current) {
        return;
      }

      const container = document.getElementById(turnstileContainerId);
      if (!container) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: turnstileSiteKey!,
        callback: (token) => {
          setTurnstileToken(token);
          setErrorMessage(null);
        },
        "error-callback": () => {
          setTurnstileToken(null);
          setErrorMessage("Turnstile verification failed. Try again.");
        },
        "expired-callback": () => {
          setTurnstileToken(null);
        },
      });
    };

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existingScript) {
      renderWidget();
      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileContainerId, turnstileEnabled, turnstileSiteKey]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!lectureUrl.trim()) {
      setErrorMessage("Enter a YUTorah lecture URL.");
      return;
    }

    if (!turnstileEnabled) {
      setErrorMessage(
        "Turnstile is not configured. Add site and secret keys to submit analyses.",
      );
      return;
    }

    if (!turnstileToken) {
      setErrorMessage("Complete the Turnstile check before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          lectureUrl,
          turnstileToken,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });

      const payload = (await response.json()) as SubmitResponse & SubmitErrorResponse;

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Unable to submit analysis.");
        resetTurnstile();
        return;
      }

      if (payload.reused) {
        setSuccessMessage("Reusing an existing completed analysis. Redirecting...");
      } else {
        setSuccessMessage("Analysis queued. Redirecting...");
      }

      router.push(`/analyses/${payload.analysisId}`);
    } catch {
      setErrorMessage("Network error while submitting analysis.");
      resetTurnstile();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="analysis-form-panel" aria-labelledby="analysis-form-title">
      <div className="panel-heading">
        <h2 id="analysis-form-title">Submit a shiur</h2>
        <p>Paste a YUTorah lecture URL to analyze where the shiur begins and ends.</p>
      </div>

      {errorMessage ? (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="form-message form-message-success" role="status">
          {successMessage}
        </p>
      ) : null}

      <form className="analysis-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="lecture-url">
          YUTorah URL
        </label>
        <input
          id="lecture-url"
          name="lectureUrl"
          type="url"
          className="field-input"
          placeholder="https://www.yutorah.org/lectures/lecture.cfm/948110"
          value={lectureUrl}
          onChange={(event) => setLectureUrl(event.target.value)}
          required
          disabled={isSubmitting}
        />

        {turnstileEnabled ? (
          <div
            id={turnstileContainerId}
            className="turnstile-widget"
            aria-label="Cloudflare Turnstile challenge"
          />
        ) : (
          <p className="form-note" role="note">
            Turnstile is not configured locally. Set{" "}
            <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> and{" "}
            <code>TURNSTILE_SECRET_KEY</code> to enable protected submissions.
          </p>
        )}

        <p className="form-note">Each new analysis costs one credit.</p>

        <button
          type="submit"
          className="button-primary"
          disabled={
            isSubmitting || !turnstileEnabled || (turnstileEnabled && !turnstileToken)
          }
        >
          {isSubmitting ? "Submitting..." : "Analyze shiur"}
        </button>
      </form>
    </section>
  );
}