import type {
  WorkflowAnalysisContext,
  WorkflowSoferState,
  WorkflowStage,
} from "@/lib/analysis/workflow-types";
import type { AnalysisStatus } from "@/lib/analysis/submit";
import type { DafYomiReport } from "@/lib/domain/report";

export type AnalysisPageRecord = {
  pageNumber: number;
  dafRef: string;
  storagePath: string;
  imageWidth: number;
  imageHeight: number;
};

export type WorkflowStore = {
  getAnalysisContext(analysisId: string): Promise<WorkflowAnalysisContext | null>;
  getSoferState(analysisId: string): Promise<WorkflowSoferState | null>;
  saveSoferState(
    analysisId: string,
    state: WorkflowSoferState,
  ): Promise<WorkflowSoferState>;
  setStage(analysisId: string, stage: WorkflowStage): Promise<void>;
  setStatus(analysisId: string, status: AnalysisStatus): Promise<void>;
  saveReport(analysisId: string, report: DafYomiReport): Promise<void>;
  setWorkflowError(analysisId: string, message: string): Promise<void>;
  listAnalysisPages(analysisId: string): Promise<AnalysisPageRecord[]>;
  saveAnalysisPage(analysisId: string, page: AnalysisPageRecord): Promise<void>;
};

type WorkflowStateRecord = {
  context: WorkflowAnalysisContext | null;
  sofer: WorkflowSoferState | null;
  stage: WorkflowStage | null;
  status: AnalysisStatus;
  report: DafYomiReport | null;
  error: string | null;
  pages: AnalysisPageRecord[];
};

export function createMemoryWorkflowStore(
  seed?: Partial<WorkflowStateRecord>,
): WorkflowStore & { state: WorkflowStateRecord } {
  const state: WorkflowStateRecord = {
    context: seed?.context ?? null,
    sofer: seed?.sofer ?? null,
    stage: seed?.stage ?? null,
    status: seed?.status ?? "pending",
    report: seed?.report ?? null,
    error: seed?.error ?? null,
    pages: seed?.pages ?? [],
  };

  return {
    state,
    async getAnalysisContext() {
      return state.context;
    },
    async getSoferState() {
      return state.sofer;
    },
    async saveSoferState(_analysisId, nextState) {
      state.sofer = nextState;
      return nextState;
    },
    async setStage(_analysisId, stage) {
      state.stage = stage;
    },
    async setStatus(_analysisId, status) {
      state.status = status;
    },
    async saveReport(_analysisId, report) {
      state.report = report;
    },
    async setWorkflowError(_analysisId, message) {
      state.error = message;
    },
    async listAnalysisPages() {
      return state.pages;
    },
    async saveAnalysisPage(_analysisId, page) {
      const existingIndex = state.pages.findIndex(
        (entry) => entry.dafRef === page.dafRef,
      );
      if (existingIndex >= 0) {
        state.pages[existingIndex] = page;
        return;
      }
      state.pages.push(page);
    },
  };
}