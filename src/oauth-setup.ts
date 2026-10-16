/**
 * Browser-based OAuth setup for the Tag Manager MCP — runs entirely in the Worker.
 * Visit `/setup?token=<MCP_AUTH_TOKEN>` to get a refresh token with the
 * Tag Manager (tagmanager.readonly) scope.
 */

import type { Env } from "./index";

const SCOPES = ["https://www.googleapis.com/auth/tagmanager.readonly"].join(" ");

function page(title: string, bodyHtml: string): Response {
  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,Tahoma,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.8;color:#111}
  code,textarea{font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr}
  textarea{width:100%;height:90px;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:13px}
  .box{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:10px;padding:16px;margin:16px 0}
  .ok{color:#116329}.err{color:#b91c1c}
</style></head>
<body>${bodyHtml}</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export function handleSetupStart(request: Request, env: Env): Response {
  const url = new URL(request.url);
  const provided = (url.searchParams.get("token") ?? "").trim();
  const configured = (env.MCP_AUTH_TOKEN ?? "").trim();

  if (!configured || provided !== configured) {
    const diag = !configured
      ? `روی این Worker اصلاً <code>MCP_AUTH_TOKEN</code> ست نشده (طول: 0). آن را در <b>Settings → Variables and Secrets</b> (بخش Runtime، نه Builds) ست کن.`
      : `secret ست شده (طول: ${configured.length}) ولی با توکن آدرس (طول: ${provided.length}) یکی نیست.`;
    return page(
      "دسترسی رد شد",
      `<h1 class="err">دسترسی رد شد</h1>
       <div class="box"><code>${url.origin}/setup?token=<b>MCP_AUTH_TOKEN</b></code></div>
       <div class="box">🔎 ${diag}</div>`,
    );
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return page(
      "تنظیمات ناقص",
      `<h1 class="err">هنوز آماده نیست</h1>
       <p>اول <code>GOOGLE_CLIENT_ID</code> و <code>GOOGLE_CLIENT_SECRET</code> را ست کن.</p>`,
    );
  }

  const redirectUri = `${url.origin}/auth/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", configured);

  return Response.redirect(authUrl.toString(), 302);
}

export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return page("خطا", `<h1 class="err">اجازه داده نشد</h1><p>${oauthError}</p>`);
  }
  if (!env.MCP_AUTH_TOKEN || (state ?? "").trim() !== env.MCP_AUTH_TOKEN.trim()) {
    return page("خطا", `<h1 class="err">state نامعتبر</h1><p>دوباره از <code>/setup</code> شروع کن.</p>`);
  }
  if (!code) {
    return page("خطا", `<h1 class="err">کدی دریافت نشد</h1>`);
  }

  const redirectUri = `${url.origin}/auth/callback`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as { refresh_token?: string; error_description?: string };

  if (!data.refresh_token) {
    return page(
      "توکن نیامد",
      `<h1 class="err">Refresh token دریافت نشد</h1>
       <p>${data.error_description ?? "علت نامشخص"}</p>
       <p>دسترسی قبلی را از <a href="https://myaccount.google.com/permissions" target="_blank">این صفحه</a> حذف کن و دوباره تلاش کن.</p>`,
    );
  }

  return page(
    "موفق",
    `<h1 class="ok">✅ موفق شدی!</h1>
     <p>این <b>Refresh Token</b> را در داشبورد Cloudflare به‌عنوان secret زیر ست کن:</p>
     <div class="box"><code>GOOGLE_REFRESH_TOKEN</code></div>
     <textarea readonly onclick="this.select()">${data.refresh_token}</textarea>`,
  );
}
