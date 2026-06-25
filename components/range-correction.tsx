"use client";

import { useState, useTransition } from "react";

import type { RangeDetectionResult } from "@/lib/domain/report";

type RangeCorrectionProps = {
  analysisId: string;
  generatedRange: RangeDetectionResult;
  manualStartRef?: string | null;
  manualEndRef?: string | null;
};

export function RangeCorrection({
  analysisId,
  generatedRange,
  manualStartRef,
  manualEndRef,
}: RangeCorrectionProps) {
  const [startRef, setStartRef] = useState(manualStartRef ?? generatedRange.start?.id ?? "");
  const [endRef, setEndRef] = useState(manualEndRef ?? generatedRange.end?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="panel" aria-labelledby="correction-title">
      <div className="panel-heading">
        <h2 id="correction-title">Manual correction</h2>
        <p>Override the detected start and end without replacing the generated result.</p>
      </div>

      <form
        className="correction-form"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          startTransition(async () => {
            const response = await fetch(`/api/analyses/${analysisId}/correction`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                manualStartRef: startRef,
                manualEndRef: endRef,
              }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) {
              setMessage(payload.error ?? "Correction failed.");
              return;
            }
            setMessage("Correction saved.");
          });
        }}
      >
        <label className="field-label" htmlFor="manual-start-ref">
          Corrected start
        </label>
        <input
          id="manual-start-ref"
          className="field-input"
          value={startRef}
          onChange={(event) => setStartRef(event.target.value)}
          placeholder="Shabbat 2a:1"
          required
        />

        <label className="field-label" htmlFor="manual-end-ref">
          Corrected end
        </label>
        <input
          id="manual-end-ref"
          className="field-input"
          value={endRef}
          onChange={(event) => setEndRef(event.target.value)}
          placeholder="Shabbat 2b:14"
          required
        />

        <button type="submit" className="button-secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Save correction"}
        </button>
      </form>

      {message ? <p className="form-note">{message}</p> : null}
      <p className="form-note">
        Generated range remains available for comparison:{" "}
        {generatedRange.start?.id ?? "unknown"} → {generatedRange.end?.id ?? "unknown"}
      </p>
    </section>
  );
}