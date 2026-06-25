export async function enqueueAnalysis(analysisId: string): Promise<void> {
  const { start } = await import("workflow/api");
  const { runAnalysisWorkflow } = await import("@/lib/analysis/workflow");
  await start(runAnalysisWorkflow, [analysisId]);
}