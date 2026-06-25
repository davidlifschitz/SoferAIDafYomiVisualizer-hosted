import "server-only";

import { SoferClient } from "@/lib/services/sofer";

export function getSoferApiKey(): string | undefined {
  return process.env.SOFER_API_KEY;
}

export function createSoferClient(): SoferClient {
  return new SoferClient({ apiKey: getSoferApiKey() });
}