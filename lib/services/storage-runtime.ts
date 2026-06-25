import "server-only";

import {
  AnalysisStorageClient,
  type AnalysisStorageClientOptions,
} from "@/lib/services/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export function createAnalysisStorageClient(
  options: AnalysisStorageClientOptions = {},
): AnalysisStorageClient {
  return new AnalysisStorageClient({
    ...options,
    admin: createAdminClient(),
  });
}