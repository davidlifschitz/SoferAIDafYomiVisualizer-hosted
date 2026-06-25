import { randomUUID } from "node:crypto";

import type { PublicationMode } from "../../lib/analysis/publication";
import { createE2EAdminClient } from "./supabase";

const SAMPLE_REPORT = {
  generatedAt: "2026-06-25T00:00:00.000Z",
  status: "complete",
  source: {
    lectureUrl: "https://www.yutorah.org/lectures/lecture.cfm/948110",
    title: "E2E Publication Fixture",
    speaker: "Rabbi Test",
  },
  transcript: {
    source: "sofer",
    textPreview: "Today's daf is Shabbos Daf Beis",
  },
  sefaria: {
    refs: ["Shabbat 2a", "Shabbat 2b"],
    pages: [],
  },
  range: {
    start: { id: "Shabbat 2a:1", ref: "Shabbat 2a" },
    end: { id: "Shabbat 2b:14", ref: "Shabbat 2b" },
    confidence: 0.53,
    startCandidates: [],
    endCandidates: [],
    windows: { first: "", last: "" },
  },
};

export type SeededPublicationFixture = {
  publicId: string;
  title: string;
  mode: PublicationMode;
};

export async function seedPublicationFixture(
  mode: PublicationMode,
  title: string,
): Promise<SeededPublicationFixture> {
  const admin = createE2EAdminClient();
  const publicId = randomUUID();
  const userId = randomUUID();
  const lectureId = randomUUID();
  const analysisId = randomUUID();

  const { error: userError } = await admin.auth.admin.createUser({
    id: userId,
    email: `publication-${publicId}@example.com`,
    email_confirm: true,
  });
  if (userError) {
    throw userError;
  }

  const { error: lectureError } = await admin.from("canonical_lectures").insert({
    id: lectureId,
    source_key: `yutorah:e2e-${publicId}`,
    source_url: "https://www.yutorah.org/lectures/lecture.cfm/948110",
    title: "E2E lecture",
  });
  if (lectureError) {
    throw lectureError;
  }

  const { error: analysisError } = await admin.from("analyses").insert({
    id: analysisId,
    canonical_lecture_id: lectureId,
    requested_by: userId,
    idempotency_key: `e2e-publication:${publicId}`,
    status: "complete",
    report_payload: SAMPLE_REPORT,
  });
  if (analysisError) {
    throw analysisError;
  }

  const { error: resultError } = await admin.from("user_results").insert({
    user_id: userId,
    analysis_id: analysisId,
    publication_mode: mode,
    public_id: publicId,
    title,
  });
  if (resultError) {
    throw resultError;
  }

  return { publicId, title, mode };
}