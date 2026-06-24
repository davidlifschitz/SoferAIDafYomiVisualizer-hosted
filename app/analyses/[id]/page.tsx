import { AppShell } from "@/components/app-shell";

type AnalysisPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;

  return (
    <AppShell activePath="/">
      <section className="dashboard-heading" aria-labelledby="analysis-title">
        <p className="eyebrow">Analysis</p>
        <h1 id="analysis-title">Analysis {id}</h1>
        <p>Workflow progress and completed results will render here.</p>
      </section>
    </AppShell>
  );
}