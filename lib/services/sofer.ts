export type SoferBatchId = string;
export type SoferTranscriptionId = string;
export type SoferJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | (string & {});

export interface SoferClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface SoferExpressBatchRequest {
  audioUrl: string;
  title: string;
  clientItemId?: string;
}

export interface SoferBatchCreateResponse {
  batch_id: SoferBatchId;
  [key: string]: unknown;
}

export interface SoferBatchStatusResponse {
  status?: SoferJobStatus;
  batch_id?: SoferBatchId;
  [key: string]: unknown;
}

export interface SoferTranscriptionInfo {
  id?: SoferTranscriptionId;
  status?: SoferJobStatus;
  duration?: number;
  created_at?: string;
  model?: string;
}

export interface SoferTranscription {
  info?: SoferTranscriptionInfo;
  text?: string;
  transcript?: string;
  segments?: Array<{ text?: string }>;
  timestamps?: unknown[];
}

export class SoferClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor({
    apiKey,
    baseUrl = "https://api.sofer.ai",
    fetchImpl = fetch,
  }: SoferClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  requireKey(): void {
    if (!this.apiKey) {
      throw new Error("SOFER_API_KEY is required for live Sofer.AI requests");
    }
  }

  private headers(): HeadersInit {
    this.requireKey();
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    };
  }

  async createExpressBatch({
    audioUrl,
    title,
    clientItemId = "yutorah-lecture",
  }: SoferExpressBatchRequest): Promise<SoferBatchCreateResponse> {
    if (!audioUrl) {
      throw new Error("audioUrl is required for Sofer express transcription");
    }

    const response = await this.fetchImpl(`${this.baseUrl}/v1/transcriptions/batch`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        info: {
          model: "v1",
          primary_language: "en",
          hebrew_word_format: ["en", "he"],
          num_speakers: 1,
        },
        processing_mode: "express",
        audio_sources: [
          {
            audio_url: audioUrl,
            title,
            client_item_id: clientItemId,
          },
        ],
        batch_title: title,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sofer batch create failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<SoferBatchCreateResponse>;
  }

  async getBatchStatus(batchId: SoferBatchId): Promise<SoferBatchStatusResponse> {
    if (!batchId) throw new Error("batchId is required");
    const response = await this.fetchImpl(
      `${this.baseUrl}/v1/transcriptions/batch/${batchId}/status`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw new Error(`Sofer batch status failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<SoferBatchStatusResponse>;
  }

  async getByClientItemId(
    batchId: SoferBatchId,
    clientItemId: string,
  ): Promise<Record<string, unknown>> {
    if (!batchId) throw new Error("batchId is required");
    if (!clientItemId) throw new Error("clientItemId is required");
    const encoded = encodeURIComponent(clientItemId);
    const response = await this.fetchImpl(
      `${this.baseUrl}/v1/transcriptions/batch/${batchId}/items/by-client-item-id/${encoded}`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw new Error(
        `Sofer client item lookup failed: ${response.status} ${response.statusText}`,
      );
    }
    return response.json() as Promise<Record<string, unknown>>;
  }

  async getTranscription(
    transcriptionId: SoferTranscriptionId,
  ): Promise<SoferTranscription> {
    if (!transcriptionId) throw new Error("transcriptionId is required");
    const response = await this.fetchImpl(
      `${this.baseUrl}/v1/transcriptions/${transcriptionId}`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw new Error(
        `Sofer transcription fetch failed: ${response.status} ${response.statusText}`,
      );
    }
    return response.json() as Promise<SoferTranscription>;
  }
}

export function extractSoferBatchId(
  response: SoferBatchCreateResponse | SoferBatchStatusResponse | null | undefined,
): SoferBatchId | undefined {
  const batchId = response?.batch_id;
  return typeof batchId === "string" && batchId.length > 0 ? batchId : undefined;
}

export function isTerminalSoferStatus(status: SoferJobStatus | undefined): boolean {
  return status === "completed" || status === "failed";
}

export function extractSoferTranscriptText(
  transcription: SoferTranscription | null | undefined,
): string {
  if (!transcription) return "";
  if (typeof transcription.text === "string") return transcription.text;
  if (typeof transcription.transcript === "string") return transcription.transcript;
  if (Array.isArray(transcription.segments)) {
    return transcription.segments
      .map((segment) => segment.text || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}