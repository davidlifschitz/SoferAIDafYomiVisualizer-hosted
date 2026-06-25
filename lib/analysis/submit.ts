import { enqueueAnalysis } from "@/lib/analysis/enqueue";
import type { RateLimiter } from "@/lib/analysis/rate-limit";
import { canonicalLectureKey } from "@/lib/domain/lecture-key";
import type { TurnstileClient } from "@/lib/services/turnstile";

export type AnalysisStatus =
  | "pending"
  | "processing"
  | "partial"
  | "complete"
  | "failed";

export type CanonicalLectureRecord = {
  id: string;
  source_key: string;
  source_url: string;
  title: string;
};

export type AnalysisRecord = {
  id: string;
  canonical_lecture_id: string;
  requested_by: string;
  idempotency_key: string;
  status: AnalysisStatus;
};

export type AppSettingsRecord = {
  submissions_paused: boolean;
  monthly_spend_cap_cents: number | null;
};

export type SubmitInput = {
  userId: string;
  lectureUrl: string;
  turnstileToken: string;
  idempotencyKey?: string;
  remoteIp?: string;
};

export type SubmitResult = {
  analysisId: string;
  status: AnalysisStatus;
  reused?: boolean;
};

export type SubmitErrorCode =
  | "unauthorized"
  | "invalid_turnstile"
  | "rate_limited"
  | "submissions_paused"
  | "invalid_lecture_url"
  | "insufficient_credits"
  | "concurrency_limited"
  | "internal_error";

export class SubmitError extends Error {
  readonly code: SubmitErrorCode;

  constructor(code: SubmitErrorCode, message: string) {
    super(message);
    this.name = "SubmitError";
    this.code = code;
  }
}

export type SubmitStore = {
  getAppSettings(): Promise<AppSettingsRecord | null>;
  findCanonicalLecture(sourceKey: string): Promise<CanonicalLectureRecord | null>;
  upsertCanonicalLecture(
    sourceKey: string,
    sourceUrl: string,
    title: string,
  ): Promise<CanonicalLectureRecord>;
  findCompletedAnalysis(
    canonicalLectureId: string,
  ): Promise<AnalysisRecord | null>;
  findAnalysisByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AnalysisRecord | null>;
  countActiveAnalyses(userId: string): Promise<number>;
  getBalance(userId: string): Promise<number>;
  createAnalysis(input: {
    canonicalLectureId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<AnalysisRecord>;
  deleteAnalysis(analysisId: string): Promise<void>;
  chargeCredit(
    userId: string,
    idempotencyKey: string,
    analysisId: string,
  ): Promise<number>;
};

export type SubmitDependencies = {
  turnstile: TurnstileClient;
  rateLimiter: RateLimiter;
  store: SubmitStore;
  maxConcurrentAnalyses?: number;
  enqueue?: (analysisId: string) => Promise<void>;
};

const DEFAULT_MAX_CONCURRENT_ANALYSES = 3;

export function resolveIdempotencyKey(
  userId: string,
  sourceKey: string,
  clientKey?: string,
): string {
  if (clientKey?.trim()) {
    return clientKey.trim();
  }

  return `submit:${userId}:${sourceKey}`;
}

function lectureTitleFromKey(sourceKey: string): string {
  const [, lectureId] = sourceKey.split(":");
  return lectureId ? `YUTorah lecture ${lectureId}` : "YUTorah lecture";
}

function isInsufficientCreditsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return message.includes("insufficient_credits");
}

export async function submitAnalysis(
  input: SubmitInput,
  deps: SubmitDependencies,
): Promise<SubmitResult> {
  const {
    turnstile,
    rateLimiter,
    store,
    maxConcurrentAnalyses = DEFAULT_MAX_CONCURRENT_ANALYSES,
    enqueue = enqueueAnalysis,
  } = deps;

  if (!input.userId.trim()) {
    throw new SubmitError("unauthorized", "Authentication is required.");
  }

  const turnstileValid = await turnstile.verify(
    input.turnstileToken,
    input.remoteIp,
  );
  if (!turnstileValid) {
    throw new SubmitError("invalid_turnstile", "Turnstile verification failed.");
  }

  if (!rateLimiter.allowUser(input.userId)) {
    throw new SubmitError("rate_limited", "Too many submissions. Try again later.");
  }

  if (input.remoteIp && !rateLimiter.allowIp(input.remoteIp)) {
    throw new SubmitError("rate_limited", "Too many submissions. Try again later.");
  }

  const settings = await store.getAppSettings();
  if (settings?.submissions_paused) {
    throw new SubmitError(
      "submissions_paused",
      "Submissions are temporarily paused.",
    );
  }

  let sourceKey: string;
  try {
    sourceKey = canonicalLectureKey(input.lectureUrl);
  } catch {
    throw new SubmitError(
      "invalid_lecture_url",
      "Unsupported or invalid YUTorah lecture URL.",
    );
  }

  const idempotencyKey = resolveIdempotencyKey(
    input.userId,
    sourceKey,
    input.idempotencyKey,
  );

  const existingByIdempotency = await store.findAnalysisByIdempotencyKey(
    idempotencyKey,
  );
  if (existingByIdempotency) {
    return {
      analysisId: existingByIdempotency.id,
      status: existingByIdempotency.status,
    };
  }

  let canonicalLecture = await store.findCanonicalLecture(sourceKey);
  if (!canonicalLecture) {
    canonicalLecture = await store.upsertCanonicalLecture(
      sourceKey,
      input.lectureUrl,
      lectureTitleFromKey(sourceKey),
    );
  }

  const completedAnalysis = await store.findCompletedAnalysis(canonicalLecture.id);
  if (completedAnalysis) {
    return {
      analysisId: completedAnalysis.id,
      status: completedAnalysis.status,
      reused: true,
    };
  }

  const activeAnalyses = await store.countActiveAnalyses(input.userId);
  if (activeAnalyses >= maxConcurrentAnalyses) {
    throw new SubmitError(
      "concurrency_limited",
      "You already have the maximum number of analyses in progress.",
    );
  }

  const balance = await store.getBalance(input.userId);
  if (balance < 1) {
    throw new SubmitError("insufficient_credits", "Insufficient credits.");
  }

  const analysis = await store.createAnalysis({
    canonicalLectureId: canonicalLecture.id,
    userId: input.userId,
    idempotencyKey,
  });

  try {
    await store.chargeCredit(input.userId, idempotencyKey, analysis.id);
  } catch (error) {
    await store.deleteAnalysis(analysis.id);

    if (isInsufficientCreditsError(error)) {
      throw new SubmitError("insufficient_credits", "Insufficient credits.");
    }

    throw error;
  }

  await enqueue(analysis.id);

  return {
    analysisId: analysis.id,
    status: analysis.status,
  };
}