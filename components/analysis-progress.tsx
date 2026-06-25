const STAGES = [
  { id: "resolving", label: "Resolving lecture" },
  { id: "transcribing", label: "Transcribing audio" },
  { id: "matching", label: "Matching Sefaria range" },
  { id: "capturing", label: "Capturing daf pages" },
  { id: "complete", label: "Complete" },
] as const;

export type AnalysisStage = (typeof STAGES)[number]["id"];

type AnalysisProgressProps = {
  currentStage: AnalysisStage;
};

export function AnalysisProgress({ currentStage }: AnalysisProgressProps) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === currentStage);

  return (
    <section className="analysis-progress" aria-label="Analysis progress">
      <ol className="analysis-progress-list">
        {STAGES.map((stage, index) => {
          const state =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming";

          return (
            <li
              key={stage.id}
              className={`analysis-progress-item analysis-progress-item-${state}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="analysis-progress-marker" aria-hidden="true" />
              <span>{stage.label}</span>
              {state === "current" ? (
                <span className="sr-only"> (current step)</span>
              ) : state === "complete" ? (
                <span className="sr-only"> (complete)</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}