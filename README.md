<div dir="rtl">

# MCP گوگل تگ منیجر (Google Tag Manager)

یک سرور MCP مستقل برای **Google Tag Manager** — فقط‌خواندنی (readonly). این کانکتور برای **بازرسی و ممیزی پیکربندی کانتینر** است: چه تگ‌ها، Triggerها و Variableهایی نصب‌اند و نسخه‌ی منتشرشده‌ی زنده چیست.

> ⚠️ توجه: GTM آمار ترافیک/کلیک/تبدیل **ندارد**؛ آن‌ها در GA4 و Google Ads هستند. اینجا فقط «تنظیماتِ تگ» را می‌بینی.

---

## مرحله ۱) ساخت OAuth Client جدا برای GTM
در همان پروژه‌ی Google Cloud قبلی (ولی یک کلاینت مجزا):
۱. **APIs & Services → Library** → جست‌وجوی **Tag Manager API** → **Enable**.
۲. **APIs & Services → Credentials → Create credentials → OAuth client ID** → نوع **Web application**.
۳. فعلاً بدون Redirect URI بساز؛ `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` را کپی کن (بعد از ساختن Worker، آدرس `/auth/callback` را به Redirect URIها اضافه می‌کنی).
۴. مطمئن شو ایمیلِ لاگینت در **OAuth consent screen → Test users** هست.

## مرحله ۲) ساخت Worker از این ریپو
Cloudflare → **Workers & Pages → Create application → Import a repository** → ریپوی `Sepidar-GTM-MCP`:
- **Worker name:** `sepidar-gtm-mcp`  (باید با `name` در `wrangler.jsonc` یکی باشد)
- **Root directory:** خالی (`/`)
- **Deploy command:** `npx wrangler deploy`

آدرس: `https://sepidar-gtm-mcp.<اکانت>.workers.dev`

## مرحله ۳) Secretها (بخش Runtime)

| نام | مقدار |
|-----|-------|
| `MCP_AUTH_TOKEN` | یک رمز دلخواه فقط حروف و عدد |
| `GOOGLE_CLIENT_ID` | از مرحله ۱ |
| `GOOGLE_CLIENT_SECRET` | از مرحله ۱ |
| `GOOGLE_REFRESH_TOKEN` | در مرحله ۴ ساخته می‌شود |
| `GTM_DEFAULT_ACCOUNT_ID` | (اختیاری) پیش‌فرض اکانت |
| `GTM_DEFAULT_CONTAINER_ID` | (اختیاری) پیش‌فرض کانتینر |

## مرحله ۴) گرفتن Refresh Token
۱. در Google Cloud، به OAuth client این Redirect URI را اضافه کن:
`https://sepidar-gtm-mcp.<اکانت>.workers.dev/auth/callback`
۲. در مرورگر برو به:

<div dir="ltr">

```
https://sepidar-gtm-mcp.<اکانت>.workers.dev/setup?token=MCP_AUTH_TOKEN
```

</div>

۳. با گوگل لاگین کن، توکن نمایش داده‌شده را به‌عنوان secret `GOOGLE_REFRESH_TOKEN` ست کن و یک بار **Redeploy** بزن.

## مرحله ۵) اتصال به Claude

<div dir="ltr">

```
https://sepidar-gtm-mcp.<اکانت>.workers.dev/mcp?key=MCP_AUTH_TOKEN
```

</div>

---

## ابزارها
| ابزار | کار |
|------|-----|
| `ping` | چک سلامت + پیش‌فرض‌های ست‌شده |
| `list_gtm_accounts` | اکانت‌های GTM در دسترس |
| `list_containers` | کانتینرهای یک اکانت (شناسه + `GTM-XXXX`) |
| `list_workspaces` | ورک‌اسپیس‌های یک کانتینر |
| `gtm_live_version` | **نسخه‌ی زنده‌ی منتشرشده** با همه‌ی تگ/Trigger/Variable (بهترین ابزار برای آدیت) |
| `list_version_headers` | تاریخچه‌ی نسخه‌های منتشرشده |
| `list_tags` / `list_triggers` / `list_variables` | محتوای درفتِ ورک‌اسپیس (پیش‌فرض ورک‌اسپیس `1`) |
| `gtm_api_get` | GET خام روی هر مسیر Tag Manager API v2 (فقط خواندن) |

## محدوده‌ی دسترسی (Scope)
`https://www.googleapis.com/auth/tagmanager.readonly` — فقط‌خواندنی؛ این کانکتور هیچ تگی را تغییر/منتشر نمی‌کند.

</div>
