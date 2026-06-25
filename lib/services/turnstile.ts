const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

export type TurnstileClient = {
  verify(token: string, remoteIp?: string): Promise<boolean>;
};

export function createTurnstileClient(
  secret: string,
  fetchImpl: typeof fetch = fetch,
): TurnstileClient {
  return {
    async verify(token: string, remoteIp?: string): Promise<boolean> {
      return verifyTurnstile(token, secret, remoteIp, fetchImpl);
    },
  };
}

export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!token.trim() || !secret.trim()) {
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as TurnstileVerifyResponse;
  return payload.success === true;
}

export function getTurnstileSecret(): string {
  return process.env.TURNSTILE_SECRET_KEY ?? "";
}