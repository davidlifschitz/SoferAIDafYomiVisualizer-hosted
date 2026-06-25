import { NextResponse } from "next/server";
import { z } from "zod";

import { createDefaultSubmitDependencies } from "@/lib/analysis/submit-store";
import { SubmitError, submitAnalysis } from "@/lib/analysis/submit";
import { getVerifiedClaims } from "@/lib/auth/session";

const submitBodySchema = z.object({
  lectureUrl: z.string().min(1),
  turnstileToken: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});

function statusForSubmitError(code: SubmitError["code"]): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "invalid_turnstile":
    case "invalid_lecture_url":
      return 400;
    case "rate_limited":
    case "concurrency_limited":
      return 429;
    case "submissions_paused":
    case "spending_cap_reached":
      return 503;
    case "insufficient_credits":
      return 402;
    case "internal_error":
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = submitBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const remoteIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  try {
    const result = await submitAnalysis(
      {
        userId,
        lectureUrl: parsed.data.lectureUrl,
        turnstileToken: parsed.data.turnstileToken,
        idempotencyKey: parsed.data.idempotencyKey,
        remoteIp,
      },
      createDefaultSubmitDependencies(),
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof SubmitError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusForSubmitError(error.code) },
      );
    }

    console.error("[POST /api/analyses]", error);
    return NextResponse.json(
      { error: "Unable to submit analysis." },
      { status: 500 },
    );
  }
}