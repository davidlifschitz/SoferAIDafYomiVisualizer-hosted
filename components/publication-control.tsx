"use client";

import { useState, useTransition } from "react";

import type { PublicationMode } from "@/lib/analysis/publication";

type PublicationControlProps = {
  resultId: string;
  publicationMode: PublicationMode;
  publicId: string;
};

const MODE_LABELS: Record<PublicationMode, string> = {
  private: "Private",
  unlisted: "Unlisted share link",
  public: "Listed in library",
};

export function PublicationControl({
  resultId,
  publicationMode,
  publicId,
}: PublicationControlProps) {
  const [mode, setMode] = useState(publicationMode);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="panel" aria-labelledby="publication-title">
      <div className="panel-heading">
        <h2 id="publication-title">Publication</h2>
        <p>Control who can discover this result.</p>
      </div>

      <form
        className="publication-form"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          startTransition(async () => {
            const response = await fetch(`/api/results/${resultId}/publication`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ publicationMode: mode }),
            });
            const payload = (await response.json()) as {
              error?: string;
              shareUrl?: string;
            };
            if (!response.ok) {
              setMessage(payload.error ?? "Publication update failed.");
              return;
            }
            setMessage(
              mode === "private"
                ? "Result is private."
                : `Share link: ${payload.shareUrl ?? `/r/${publicId}`}`,
            );
          });
        }}
      >
        <label className="field-label" htmlFor="publication-mode">
          Visibility
        </label>
        <select
          id="publication-mode"
          className="field-input"
          value={mode}
          onChange={(event) => setMode(event.target.value as PublicationMode)}
        >
          {(Object.keys(MODE_LABELS) as PublicationMode[]).map((option) => (
            <option key={option} value={option}>
              {MODE_LABELS[option]}
            </option>
          ))}
        </select>

        <button type="submit" className="button-secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Update visibility"}
        </button>
      </form>

      {message ? <p className="form-note">{message}</p> : null}
      {mode !== "private" ? (
        <p className="form-note">
          Share URL: <code>/r/{publicId}</code>
        </p>
      ) : null}
    </section>
  );
}