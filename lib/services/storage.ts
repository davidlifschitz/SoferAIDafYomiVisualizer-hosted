import type { SupabaseClient } from "@supabase/supabase-js";

export const ANALYSIS_PAGES_BUCKET = "analysis-pages";
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

export function analysisPageStoragePath(
  analysisId: string,
  dafRef: string,
): string {
  const slug = dafRef.trim().replace(/\s+/g, "-");
  return `analyses/${analysisId}/${slug}.png`;
}

export type AnalysisStorageClientOptions = {
  bucket?: string;
};

export class AnalysisStorageClient {
  private readonly bucket: string;
  private readonly admin: SupabaseClient;

  constructor({
    bucket = ANALYSIS_PAGES_BUCKET,
    admin,
  }: AnalysisStorageClientOptions & { admin: SupabaseClient }) {
    this.bucket = bucket;
    this.admin = admin;
  }

  async uploadAnalysisPage(
    analysisId: string,
    dafRef: string,
    bytes: Buffer,
    contentType = "image/png",
  ): Promise<string> {
    const path = analysisPageStoragePath(analysisId, dafRef);
    const { error } = await this.admin.storage.from(this.bucket).upload(path, bytes, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload analysis page ${dafRef}: ${error.message}`);
    }

    return path;
  }

  async getSignedUrl(
    storagePath: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const { data, error } = await this.admin.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to sign storage URL for ${storagePath}`);
    }

    return data.signedUrl;
  }
}

