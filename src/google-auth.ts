/**
 * Google OAuth helper: exchange a long-lived refresh token for a short-lived
 * access token. The refresh token must carry the Tag Manager scope
 * (https://www.googleapis.com/auth/tagmanager.readonly).
 */

import type { Env } from "./index";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(
      `Failed to refresh Google access token (HTTP ${res.status}): ${await res.text()}`,
    );
  }

  const data = (await res.json()) as TokenResponse;
  cached = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return data.access_token;
}
