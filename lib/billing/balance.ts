import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserBalance(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_credit_balance");

  if (error) {
    return 0;
  }

  return Number(data ?? 0);
}