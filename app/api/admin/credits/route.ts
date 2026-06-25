import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminError, adjustCredits } from "@/lib/admin/operations";
import { createDefaultAdminStore } from "@/lib/admin/store";
import { requireAdminUserId } from "@/lib/auth/admin";

const creditsBodySchema = z.object({
  userId: z.uuid(),
  amount: z.number().int().refine((value) => value !== 0, "Amount must be non-zero."),
  reason: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const adminId = await requireAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = creditsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await adjustCredits(parsed.data, {
      store: createDefaultAdminStore(),
      adminId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[POST /api/admin/credits]", error);
    return NextResponse.json({ error: "Unable to adjust credits." }, { status: 500 });
  }
}