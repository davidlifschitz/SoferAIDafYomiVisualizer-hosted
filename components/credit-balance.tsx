import { createClient } from "@/lib/supabase/server";

export async function CreditBalance() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_credit_balance");

  if (error) {
    return (
      <div className="credit-balance" aria-label="Credit balance unavailable">
        <span className="credit-balance-label">Credits</span>
        <strong className="credit-balance-value">--</strong>
      </div>
    );
  }

  return (
    <div className="credit-balance" aria-label={`${data ?? 0} credits available`}>
      <span className="credit-balance-label">Credits</span>
      <strong className="credit-balance-value">{data ?? 0}</strong>
    </div>
  );
}