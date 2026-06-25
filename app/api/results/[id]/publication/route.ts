import { NextResponse } from "next/server";
import { z } from "zod";

import { parsePublicationMode } from "@/lib/analysis/publication";
import { createResultStore } from "@/lib/analysis/result-store";
import { getVerifiedClaims } from "@/lib/auth/session";

const bodySchema = z.object({
  publicationMode: z.string().min(1),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { id: resultId } = await context.params;
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

  const mode = parsePublicationMode(parsed.data.publicationMode);
  if (!mode) {
    return NextResponse.json({ error: "Unsupported publication mode." }, { status: 400 });
  }

  try {
    const store = createResultStore();
    const updated = await store.updatePublicationMode({
      resultId,
      userId,
      mode,
    });

    return NextResponse.json({
      id: updated.id,
      publicationMode: updated.publicationMode,
      publicId: updated.publicId,
      shareUrl: `/r/${updated.publicId}`,
    });
  } catch (error) {
    console.error("[PATCH /api/results/:id/publication]", error);
    return NextResponse.json(
      { error: "Unable to update publication mode." },
      { status: 500 },
    );
  }
}