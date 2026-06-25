export type StripeProductCode = "pack_5" | "pack_20" | "subscription";

export const STRIPE_PRODUCT_CREDITS: Record<StripeProductCode, number> = {
  pack_5: 5,
  pack_20: 20,
  subscription: 10,
};

export function parseStripeProductCode(
  value: string | null | undefined,
): StripeProductCode | null {
  if (value === "pack_5" || value === "pack_20" || value === "subscription") {
    return value;
  }
  return null;
}

export function getStripePriceId(product: StripeProductCode): string | undefined {
  switch (product) {
    case "pack_5":
      return process.env.STRIPE_PRICE_PACK_5;
    case "pack_20":
      return process.env.STRIPE_PRICE_PACK_20;
    case "subscription":
      return process.env.STRIPE_PRICE_SUB_10;
    default:
      return undefined;
  }
}