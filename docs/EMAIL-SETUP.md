# Email delivery and verification

## Resend sender domain

1. Add the sending domain (prefer a dedicated subdomain such as `mail.example.com`) in Resend and complete its domain verification.
2. Publish the exact DNS records Resend provides for that domain:
   - the domain-verification TXT record, if shown;
   - the DKIM TXT or CNAME record(s);
   - the SPF TXT record for the sending host.
3. Publish a DMARC TXT record at `_dmarc.<domain>`, starting with a monitored policy such as `p=none`; tighten it after reviewing aggregate reports.
4. Keep one SPF record per hostname. If an SPF record already exists, merge the Resend `include` mechanism into that record rather than publishing a second SPF TXT record.
5. Wait for Resend to verify the records. Use a `From` address on the verified sender domain. DNS values are unique to the Resend account; copy them from its dashboard rather than using sample values.

The application sends approval, retry, and test messages through the Resend API. It does not log the API response body, recipient email, activation token, or credentials.

## Vercel environment variables

Configure values in **Project Settings → Environment Variables**, with separate environment scopes. Do not expose server-only values with a `NEXT_PUBLIC_` prefix.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical production origin, for example `https://scamtastic.online` |
| `NEXT_PUBLIC_SITE_URL` | Preview | Non-production preview origin; it must not equal `VERCEL_PROJECT_PRODUCTION_URL` |
| `NEXT_PUBLIC_SITE_URL` | Development/local | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | All required environments | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All required environments | Browser-safe Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Admin Auth link generation and application submission |
| `APPLICATION_RATE_LIMIT_SECRET` | Server-only | HMAC key for application-submission rate limits; use a unique random value of at least 32 characters |
| `RESEND_API_KEY` | Server-only | Resend API credential |
| `EMAIL_FROM` | Server-only | Verified sender, for example `Scamtastic <access@mail.example.com>` |

Vercel's `VERCEL_ENV` and `VERCEL_PROJECT_PRODUCTION_URL` are used for deployment checks. Preview email sending fails closed if the production hostname is unavailable or if the configured site URL points to it. Non-production local development only permits loopback origins. Set the preview callback origin explicitly and ensure it is included in Supabase's redirect allow-list. Never copy production `NEXT_PUBLIC_SITE_URL` into preview or local scopes.

Missing email variables produce a server-side diagnostic naming the missing variable(s), never their values. A Resend failure is logged with an HTTP status or a generic network/timeout diagnostic; provider response bodies and credentials are not logged.

The administrator test-email action is same-origin and administrator-only. It uses only the authenticated administrator's verified email and has no recipient input. It permits one request per administrator per five minutes per running application instance. This in-process limit is best-effort on horizontally scaled/serverless deployments; keep the Vercel deployment rate limiting/firewall enabled for `/api/admin/test-email` where available. Resend also applies its account limits.

The v0.4 administrator composer is available at `/admin/email`. It requires a verified administrator session, allows no more than ten recipients per message, and permits up to five sends per administrator per hour using a database-backed reservation. Templates are sanitized before storage and sending. Delivery history stores the subject, recipient count, status, and timestamp, but not recipient addresses or message bodies. Administrator invitations at `/admin/invitations` are also server-authorized and sent through the same Resend configuration.

## Supabase Auth SMTP

The application itself sends approval and test messages using the Resend API. Configure Supabase Auth SMTP as well for other Supabase-managed messages (such as password resets and confirmations):

- Enable **Custom SMTP** in Supabase Auth settings.
- Host: `smtp.resend.com`
- Port: `465` (implicit TLS) or `587` (STARTTLS), as supported by the Supabase form.
- Username: `resend`
- Password: the Resend API key, entered only in Supabase's secret SMTP password field.
- Sender email/name: the verified `EMAIL_FROM` address and `Scamtastic`.

Do not place the SMTP password in application source, `.env.example`, a client bundle, or logs. The email test endpoint tests the application's Resend API sender, not Supabase SMTP.

## Authentication URLs

In **Supabase → Authentication → URL Configuration**:

- Set **Site URL** to the production canonical origin, such as `https://scamtastic.online`.
- Add redirect URLs for `https://scamtastic.online/auth/callback` and `http://localhost:3000/auth/callback`.
- Add the exact HTTPS callback URL for each preview host used for email testing. If using a wildcard supported by the Supabase URL allow-list, scope it narrowly to this Vercel project and team; do not allow arbitrary hosts.

Approval email callbacks are assembled from `NEXT_PUBLIC_SITE_URL` and the one-time token hash returned by Supabase Auth. No production URL is hardcoded in the sender. The callback consumes the token through Supabase Auth and then redirects to `/activate`.

## Approval failures and retry behavior

Approval status is stored before email delivery. A failed delivery is reported and can be retried from the admin applications page. Supabase creates a one-time invite link for a new Auth user. If delivery failed after Auth had already created that user, a retry uses a magic link for the existing email instead of creating a duplicate account. The callback still checks that the email is verified and belongs to an approved application; claimed applications cannot be activated again.
