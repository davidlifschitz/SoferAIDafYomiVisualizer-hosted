import { NextResponse } from "next/server";
import { z } from "zod";

import { CorrectionError } from "@/lib/analysis/correction";
import { createResultStore } from "@/lib/analysis/result-store";
import { getVerifiedClaims } from "@/lib/auth/session";

const bodySchema = z.object({
  manualStartRef: z.string().min(1),
  manualEndRef: z.string().min(1),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { id: analysisId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const store = createResultStore();
    const corrected = await store.applyCorrection({
      analysisId,
      userId,
      manualStartRef: parsed.data.manualStartRef,
      manualEndRef: parsed.data.manualEndRef,
    });

    return NextResponse.json({
      manualStartRef: corrected.manualStartRef,
      manualEndRef: corrected.manualEndRef,
      candidateRefs: corrected.candidateRefs,
      effectiveRange: corrected.effectiveRange,
      generatedRange: corrected.generatedRange,
    });
  } catch (error) {
    if (error instanceof CorrectionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    console.error("[POST /api/analyses/:id/correction]", error);
    return NextResponse.json({ error: "Unable to save correction." }, { status: 500 });
  }
}