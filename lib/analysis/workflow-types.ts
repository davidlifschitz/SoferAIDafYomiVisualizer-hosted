import type { AnalysisStage } from "@/components/analysis-progress";
import type { DafYomiReport } from "@/lib/domain/report";

export type WorkflowStage = AnalysisStage;

export type WorkflowSoferState = {
  batchId: string;
  transcriptionId?: string;
  clientItemId: string;
};

export type WorkflowAnalysisContext = {
  analysisId: string;
  lectureUrl: string;
  sourceKey: string;
  title: string;
};

export type ResolvedLecture = {
  lectureUrl: string;
  sourceKey: string;
  title: string;
  audioUrl: string;
  speaker?: string;
  dafLabel?: string;
};

export type WorkflowCaptureSummary = {
  captured: number;
  total: number;
};

export type WorkflowResult = {
  stage: WorkflowStage;
  status: "processing" | "partial" | "complete" | "failed";
  report?: DafYomiReport;
  error?: string;
};