import type { RangeDetectionResult } from "@/lib/domain/report";

type EvidenceInspectorProps = {
  range: RangeDetectionResult;
  transcriptPreview: string;
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function EvidenceInspector({
  range,
  transcriptPreview,
}: EvidenceInspectorProps) {
  return (
    <section className="evidence-inspector" aria-labelledby="evidence-title">
      <div className="panel-heading">
        <h2 id="evidence-title">Evidence</h2>
        <p>Confidence, matched segments, and transcript context.</p>
      </div>

      <dl className="evidence-grid">
        <div>
          <dt>Confidence</dt>
          <dd>
            <span aria-label={`${(range.confidence * 100).toFixed(1)} percent confidence`}>
              {(range.confidence * 100).toFixed(1)}%
            </span>
          </dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>
            <span aria-label={`Start segment ${range.start?.id ?? "unknown"}`}>
              {range.start?.id ?? "Unknown"}
            </span>
          </dd>
        </div>
        <div>
          <dt>End</dt>
          <dd>
            <span aria-label={`End segment ${range.end?.id ?? "unknown"}`}>
              {range.end?.id ?? "Unknown"}
            </span>
          </dd>
        </div>
      </dl>

      <div className="evidence-block">
        <h3>Start evidence</h3>
        <p>{stripHtml(range.start?.text ?? "No start evidence")}</p>
        {range.start?.he ? <p className="evidence-hebrew">{range.start.he}</p> : null}
      </div>

      <div className="evidence-block">
        <h3>End evidence</h3>
        <p>{stripHtml(range.end?.text ?? "No end evidence")}</p>
        {range.end?.he ? <p className="evidence-hebrew">{range.end.he}</p> : null}
      </div>

      <div className="evidence-block">
        <h3>Transcript excerpt</h3>
        <p>{transcriptPreview}</p>
      </div>
    </section>
  );
}