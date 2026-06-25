import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AdminError,
  getOperationalSnapshot,
  updateAppSettings,
} from "@/lib/admin/operations";
import { createDefaultAdminStore } from "@/lib/admin/store";
import { requireAdminUserId } from "@/lib/auth/admin";

const settingsBodySchema = z
  .object({
    submissionsPaused: z.boolean().optional(),
    monthlySpendCapCents: z.number().int().min(0).nullable().optional(),
  })
  .refine(
    (value) =>
      value.submissionsPaused !== undefined ||
      value.monthlySpendCapCents !== undefined,
    { message: "At least one setting must be provided." },
  );

export async function GET() {
  const adminId = await requireAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const snapshot = await getOperationalSnapshot(createDefaultAdminStore());
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[GET /api/admin/settings]", error);
    return NextResponse.json({ error: "Unable to load admin settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

  const parsed = settingsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const settings = await updateAppSettings(parsed.data, {
      store: createDefaultAdminStore(),
      adminId,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[PATCH /api/admin/settings]", error);
    return NextResponse.json({ error: "Unable to update settings." }, { status: 500 });
  }
}